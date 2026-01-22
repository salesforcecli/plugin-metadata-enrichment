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
import type { ComponentEnrichmentStatus } from '../../library/common/index.js';
import { EnrichmentHandler, EnrichmentMetrics } from '../../library/index.js';
import { ComponentProcessor } from '../../library/index.js';

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

    // Retrieve source components from the project
    const componentSet = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries,
        directoryPaths: [project.getPath()],
      },
    });
    const sourceComponents = componentSet.getSourceComponents().toArray();

    // Determine what is skipped based on mismatch between input and source components
    const skippedComponents = ComponentProcessor.diffRequestedComponents(
      sourceComponents,
      metadataEntries,
      project.getPath(),
    );

    // TODO - Additional validation here?
    // TODO
    // TODO
    // TODO

    // Send enrichment requests
    const connection = org.getConnection();
    const enrichmentResults = await EnrichmentHandler.enrich(connection, sourceComponents);

    // TODO - Do file parsing and updates here for the successful responses
    // TODO
    // TODO
    // TODO

    const metrics = EnrichmentMetrics.createEnrichmentMetrics(enrichmentResults, skippedComponents);

    // ---- DEBUG OUTPUT LOGGING ----

    this.log(`Total components: ${metrics.total}`);
    this.log(`Success: ${metrics.success.count}`);

    if (metrics.success.components.length > 0) {
      for (const component of metrics.success.components) {
        const comp: ComponentEnrichmentStatus = component;
        this.log(`  - ${comp.type}:${comp.componentName ?? '*'} (${comp.reason})`);
      }
    }

    this.log(`Failed: ${metrics.fail.count}`);

    if (metrics.fail.components.length > 0) {
      for (const component of metrics.fail.components) {
        const comp: ComponentEnrichmentStatus = component;
        this.log(`  - ${comp.type}:${comp.componentName ?? '*'} (${comp.reason})`);
      }
    }

    this.log(`Skipped: ${metrics.skipped.count}`);

    if (metrics.skipped.components.length > 0) {
      for (const component of metrics.skipped.components) {
        const comp: ComponentEnrichmentStatus = component;
        this.log(`  - ${comp.type}:${comp.componentName ?? '*'} (${comp.reason})`);
      }
    }

    return metrics;
  }
}
