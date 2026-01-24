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

import { expect } from 'chai';
import type { EnrichmentMetrics } from '@salesforce/metadata-enrichment';
import { LogFormatter } from '../../src/utils/logFormatter.js';

describe('LogFormatter', () => {
  describe('logMetrics', () => {
    it('should log metrics with success components', () => {
      const logMessages: string[] = [];
      const log = (message: string) => logMessages.push(message);

      const metrics: EnrichmentMetrics = {
        total: 2,
        success: {
          count: 1,
          components: [
            {
              type: 'LightningComponentBundle',
              componentName: 'TestComponent',
            },
          ],
        },
        skipped: {
          count: 0,
          components: [],
        },
        fail: {
          count: 1,
          components: [
            {
              type: 'LightningComponentBundle',
              componentName: 'FailedComponent',
              message: 'Enrichment failed',
            },
          ],
        },
      };

      LogFormatter.logMetrics(log, metrics);

      expect(logMessages).to.include('Total Components Processed: 2');
      expect(logMessages).to.include('✓ Successfully Enriched: 1');
      expect(logMessages.some((msg) => msg.includes('TestComponent'))).to.be.true;
      expect(logMessages).to.include('✗ Failed: 1');
      expect(logMessages.some((msg) => msg.includes('FailedComponent'))).to.be.true;
      expect(logMessages.some((msg) => msg.includes('Enrichment failed'))).to.be.true;
    });

    it('should log metrics with skipped components', () => {
      const logMessages: string[] = [];
      const log = (message: string) => logMessages.push(message);

      const metrics: EnrichmentMetrics = {
        total: 1,
        success: {
          count: 0,
          components: [],
        },
        skipped: {
          count: 1,
          components: [
            {
              type: 'ApexClass',
              componentName: 'SkippedComponent',
              message: 'Only Lightning Web Components are currently supported',
            },
          ],
        },
        fail: {
          count: 0,
          components: [],
        },
      };

      LogFormatter.logMetrics(log, metrics);

      expect(logMessages).to.include('Total Components Processed: 1');
      expect(logMessages).to.include('⊘ Skipped: 1');
      expect(logMessages.some((msg) => msg.includes('SkippedComponent'))).to.be.true;
      expect(logMessages.some((msg) => msg.includes('Only Lightning Web Components'))).to.be.true;
    });

    it('should log metrics with empty component lists', () => {
      const logMessages: string[] = [];
      const log = (message: string) => logMessages.push(message);

      const metrics: EnrichmentMetrics = {
        total: 0,
        success: {
          count: 0,
          components: [],
        },
        skipped: {
          count: 0,
          components: [],
        },
        fail: {
          count: 0,
          components: [],
        },
      };

      LogFormatter.logMetrics(log, metrics);

      expect(logMessages).to.include('Total Components Processed: 0');
      expect(logMessages).to.include('✓ Successfully Enriched: 0');
      expect(logMessages).to.include('⊘ Skipped: 0');
      expect(logMessages).to.include('✗ Failed: 0');
    });

    it('should handle components with undefined componentName', () => {
      const logMessages: string[] = [];
      const log = (message: string) => logMessages.push(message);

      const metrics: EnrichmentMetrics = {
        total: 1,
        success: {
          count: 1,
          components: [
            {
              type: 'LightningComponentBundle',
              componentName: undefined,
            },
          ],
        },
        skipped: {
          count: 0,
          components: [],
        },
        fail: {
          count: 0,
          components: [],
        },
      };

      LogFormatter.logMetrics(log, metrics);

      expect(logMessages.some((msg) => msg.includes('LightningComponentBundle:*'))).to.be.true;
    });
  });
});
