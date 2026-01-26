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

import type { EnrichmentMetrics } from '@salesforce/metadata-enrichment';

export class MetricsFormatter {
  /**
   * Log the formatted enrichment metrics to the console
   *
   * @param log
   * @param metrics
   */
  public static logMetrics(log: (message: string) => void, metrics: EnrichmentMetrics): void {
    log('');
    log(`Total Components Processed: ${metrics.total}`);
    log('');

    // Success section
    log(`✓ Successfully Enriched: ${metrics.success.count}`);
    if (metrics.success.components.length > 0) {
      for (const component of metrics.success.components) {
        log(`  • ${component.typeName}:${component.componentName ?? '*'}`);
      }
    }
    log('');

    // Skipped section
    log(`⊘ Skipped: ${metrics.skipped.count}`);
    if (metrics.skipped.components.length > 0) {
      for (const component of metrics.skipped.components) {
        log(`  • ${component.typeName}:${component.componentName ?? '*'}`);
        if (component.message) {
          log(`    Message: ${component.message}`);
          log('');
        }
      }
    }
    log('');

    // Failed section
    log(`✗ Failed: ${metrics.fail.count}`);
    if (metrics.fail.components.length > 0) {
      for (const component of metrics.fail.components) {
        log(`  • ${component.typeName}:${component.componentName ?? '*'}`);
        if (component.message) {
          log(`    Message: ${component.message}`);
          log('');
        }
      }
    }
    log('');
  }
}
