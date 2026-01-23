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
import { EnrichmentHandler, EnrichmentMetrics, FileProcessor } from '@salesforce/metadata-enrichment';
import { ComponentProcessor, LogFormatter } from '../../utils/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'enrich.metadata');

export default class EnrichMetadata extends SfCommand<EnrichmentMetrics> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    metadata: Flags.string({
      multiple: true,
      delimiter: ',',
      char: 'm',
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      required: true,
    }),
  };

  public async run(): Promise<EnrichmentMetrics> {
    const project = await SfProject.resolve();
    const { flags } = await this.parse(EnrichMetadata);
    const org = flags['target-org'];
    const metadataEntries = flags['metadata'];

    this.spinner.start('Retrieving project source components');
    const componentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries,
        directoryPaths: [project.getPath()],
      },
    });
    const sourceComponents = componentSet.getSourceComponents().toArray();
    const componentsToSkip = ComponentProcessor.getComponentsToSkip(
      sourceComponents,
      metadataEntries,
      project.getPath(),
    );
    const componentsToProcess = sourceComponents.filter((component) => {
      const componentName = component.fullName ?? component.name;
      return componentName && !componentsToSkip.some((skip) => skip.componentName === componentName);
    });
    this.spinner.stop();

    this.spinner.start('Executing metadata enrichment');
    const connection = org.getConnection();
    let enrichmentResults = await EnrichmentHandler.enrich(connection, componentsToProcess);
    this.spinner.stop();

    this.spinner.start('Updating metadata configuration with enriched results');
    enrichmentResults = await FileProcessor.updateMetadataFiles(componentsToProcess, enrichmentResults);
    this.spinner.stop();

    const metrics = EnrichmentMetrics.createEnrichmentMetrics(enrichmentResults, componentsToSkip);
    LogFormatter.logMetrics(this.log.bind(this), metrics);

    return metrics;
  }
}
