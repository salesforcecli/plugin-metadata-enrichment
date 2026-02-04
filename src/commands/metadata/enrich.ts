/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Messages, SfProject } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { EnrichmentHandler, EnrichmentMetrics, EnrichmentStatus, FileProcessor } from '@salesforce/metadata-enrichment';
import { ComponentProcessor } from '../../component/index.js';
import { MetricsFormatter, EnrichmentRecords } from '../../utils/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const commandMessages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'metadata.enrich');
const errorsMessages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'errors');
const metricsMessages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'metrics');

export default class MetadataEnrich extends SfCommand<EnrichmentMetrics> {
  public static readonly summary = commandMessages.getMessage('summary');
  public static readonly description = commandMessages.getMessage('description');
  public static readonly examples = commandMessages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    metadata: Flags.string({
      multiple: true,
      char: 'm',
      summary: commandMessages.getMessage('flags.metadata.summary'),
      description: commandMessages.getMessage('flags.metadata.description'),
      required: true,
    }),
  };

  public async run(): Promise<EnrichmentMetrics> {
    const project = await SfProject.resolve();
    const { flags } = await this.parse(MetadataEnrich);
    const org = flags['target-org'];
    const metadataEntries = flags['metadata'];

    this.spinner.start(commandMessages.getMessage('spinner.setup'));
    const projectComponentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries,
        directoryPaths: [project.getPath()],
      },
    });
    const projectSourceComponents = projectComponentSet.getSourceComponents().toArray();
    const enrichmentRecords = new EnrichmentRecords(projectSourceComponents, errorsMessages);

    const componentsToSkip = ComponentProcessor.getComponentsToSkip(
      projectSourceComponents,
      metadataEntries,
      project.getPath()
    );
    enrichmentRecords.addSkippedComponents(componentsToSkip);
    enrichmentRecords.updateWithStatus(componentsToSkip, EnrichmentStatus.SKIPPED);
    enrichmentRecords.generateSkipReasons(componentsToSkip, projectSourceComponents);

    const componentsEligibleToProcess = projectSourceComponents.filter((component) => {
      const componentName = component.fullName ?? component.name;
      if (!componentName) return false;
      for (const skip of componentsToSkip) {
        if (skip.componentName === componentName) return false;
      }
      return true;
    });
    this.spinner.stop();

    this.spinner.start(commandMessages.getMessage('spinner.executing', [componentsEligibleToProcess.length]));
    const connection = org.getConnection();
    const enrichmentResults = await EnrichmentHandler.enrich(connection, componentsEligibleToProcess);
    enrichmentRecords.updateWithResults(enrichmentResults);
    this.spinner.stop();

    this.spinner.start(commandMessages.getMessage('spinner.updating.files'));
    const fileUpdatedRecords = await FileProcessor.updateMetadataFiles(
      componentsEligibleToProcess,
      enrichmentRecords.recordSet
    );
    enrichmentRecords.updateWithResults(Array.from(fileUpdatedRecords));
    this.spinner.stop();

    const metrics = EnrichmentMetrics.createEnrichmentMetrics(Array.from(enrichmentRecords.recordSet));
    MetricsFormatter.logMetrics(this.log.bind(this), metrics, metricsMessages);

    return metrics;
  }
}
