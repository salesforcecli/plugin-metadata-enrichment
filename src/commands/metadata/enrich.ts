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

import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Messages, SfProject } from '@salesforce/core';
import { Flags, SfCommand, Ux } from '@salesforce/sf-plugins-core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { ComponentProcessor, EnrichmentHandler, EnrichmentMetrics, EnrichmentRecords, EnrichmentStatus, FileProcessor } from '@salesforce/metadata-enrichment';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const commandMessages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'metadata.enrich');
const metricsMessages = Messages.loadMessages('@salesforce/plugin-metadata-enrichment', 'metrics');

export default class MetadataEnrich extends SfCommand<EnrichmentMetrics> {
  public static readonly summary = commandMessages.getMessage('summary');
  public static readonly description = commandMessages.getMessage('description');
  public static readonly examples = commandMessages.getMessages('examples');
  public static readonly state = 'preview';

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

    const STAGES_MSO = [
      commandMessages.getMessage('stage.setup'),
      commandMessages.getMessage('stage.executing'), 
      commandMessages.getMessage('stage.updating.files'),
    ];

    const mso = new MultiStageOutput({
      stages: STAGES_MSO,
      title: commandMessages.getMessage('summary'),
      jsonEnabled: this.jsonEnabled(),
    });
    mso.goto(STAGES_MSO[0]);

    const projectComponentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries,
        directoryPaths: [project.getPath()],
      },
    });
    const projectSourceComponents = projectComponentSet.getSourceComponents().toArray();
    const enrichmentRecords = new EnrichmentRecords(projectSourceComponents);

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

    mso.next();

    const connection = org.getConnection();
    const enrichmentResults = await EnrichmentHandler.enrich(connection, componentsEligibleToProcess);
    enrichmentRecords.updateWithResults(enrichmentResults);

    mso.next();

    const fileUpdatedRecords = await FileProcessor.updateMetadataFiles(
      componentsEligibleToProcess,
      enrichmentRecords.recordSet
    );
    enrichmentRecords.updateWithResults(Array.from(fileUpdatedRecords));

    mso.stop();

    const metrics = EnrichmentMetrics.createEnrichmentMetrics(Array.from(enrichmentRecords.recordSet));
    const ux = new Ux();
    ux.log('');
    ux.log(metricsMessages.getMessage('metrics.total.count', [metrics.total]));
    const tableRows = [
      ...metrics.success.components.map((c) => ({
        status: 'Success',
        type: c.typeName,
        component: c.componentName,
        message: c.message,
      })),
      ...metrics.skipped.components.map((c) => ({
        status: 'Skipped',
        type: c.typeName,
        component: c.componentName,
        message: c.message,
      })),
      ...metrics.fail.components.map((c) => ({
        status: 'Failed',
        type: c.typeName,
        component: c.componentName,
        message: c.message,
      })),
    ];
    if (tableRows.length > 0) {
      ux.log('');
      ux.table({
        columns: [
          { key: 'status', name: 'Status' },
          { key: 'type', name: 'Type' },
          { key: 'component', name: 'Component' },
          { key: 'message', name: 'Message' },
        ],
        data: tableRows,
        overflow: 'wrap',
      });
    }
    ux.log('');

    return metrics;
  }
}
