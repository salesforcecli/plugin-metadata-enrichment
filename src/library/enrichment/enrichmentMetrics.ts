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

import type { ComponentEnrichmentStatus } from '../common/types.js';
import type { EnrichmentRequestRecord } from './enrichmentHandler.js';

export class EnrichmentMetrics {
  public success: {
    count: number;
    components: ComponentEnrichmentStatus[];
  };
  public fail: {
    count: number;
    components: ComponentEnrichmentStatus[];
  };
  public skipped: {
    count: number;
    components: ComponentEnrichmentStatus[];
  };
  public total: number;

  public constructor() {
    this.success = {
      count: 0,
      components: [],
    };
    this.fail = {
      count: 0,
      components: [],
    };
    this.skipped = {
      count: 0,
      components: [],
    };
    this.total = 0;
  }

  public static createEnrichmentMetrics(
    enrichmentResults: EnrichmentRequestRecord[],
    skippedComponents: ComponentEnrichmentStatus[] = [],
  ): EnrichmentMetrics {
    const metrics = new EnrichmentMetrics();

    for (const record of enrichmentResults) {
      const componentName = record.componentName;

      let metadataType = '';
      if (record.componentType) {
        metadataType = record.componentType.name;
      } else if (record.response?.results && record.response.results.length > 0) {
        metadataType = record.response.results[0].metadataType;
      }

      const component: ComponentEnrichmentStatus = {
        type: metadataType,
        componentName,
        message: record.message ?? (record.response ? '' : 'Enrichment request failed'),
      };

      if (record.response) {
        metrics.addSuccessComponent(component);
      } else {
        metrics.addFailComponent(component);
      }
    }

    skippedComponents.forEach((skippedComponent) => metrics.addSkippedComponent(skippedComponent));

    return metrics;
  }

  public addSuccessComponent(component: ComponentEnrichmentStatus): void {
    this.success.components.push(component);
    this.success.count++;
    this.total++;
  }

  public addFailComponent(component: ComponentEnrichmentStatus): void {
    this.fail.components.push(component);
    this.fail.count++;
    this.total++;
  }

  public addSkippedComponent(component: ComponentEnrichmentStatus): void {
    this.skipped.components.push(component);
    this.skipped.count++;
    this.total++;
  }
}
