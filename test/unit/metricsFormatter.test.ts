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
import type { Messages } from '@salesforce/core';
import { MetricsFormatter } from '../../src/utils/metricsFormatter.js';

function createMockMessages(): Messages<string> {
  return {
    getMessage: (key: string, args?: string[]) => (args?.length ? `${key}[${args.join(',')}]` : key),
  } as Messages<string>;
}

function createMetrics(overrides: Partial<EnrichmentMetrics> = {}): EnrichmentMetrics {
  return {
    total: 0,
    success: { count: 0, components: [] },
    skipped: { count: 0, components: [] },
    fail: { count: 0, components: [] },
    ...overrides,
  } as EnrichmentMetrics;
}

describe('MetricsFormatter', () => {
  const metricsMessages = createMockMessages();

  describe('logMetrics', () => {
    it('should log total count and empty sections when all counts are zero', () => {
      const logLines: string[] = [];
      const log = (msg: string) => logLines.push(msg);
      MetricsFormatter.logMetrics(log, createMetrics(), metricsMessages);
      expect(logLines.some((l) => l.includes('metrics.total.count') || l === '')).to.be.true;
      expect(logLines.some((l) => l.includes('metrics.success.count'))).to.be.true;
      expect(logLines.some((l) => l.includes('metrics.skipped.count'))).to.be.true;
      expect(logLines.some((l) => l.includes('metrics.fail.count'))).to.be.true;
    });

    it('should log success count and component bullets when success.components is non-empty', () => {
      const logLines: string[] = [];
      const log = (msg: string) => logLines.push(msg);
      const metrics = createMetrics({
        total: 1,
        success: {
          count: 1,
          components: [{ typeName: 'LightningComponentBundle', componentName: 'MyCmp', message: '' }],
        },
      });
      MetricsFormatter.logMetrics(log, metrics, metricsMessages);
      expect(logLines.some((l) => l.includes('MyCmp'))).to.be.true;
      expect(logLines.some((l) => l.includes('LightningComponentBundle'))).to.be.true;
    });

    it('should log skipped count and component with message when present', () => {
      const logLines: string[] = [];
      const log = (msg: string) => logLines.push(msg);
      const metrics = createMetrics({
        total: 1,
        skipped: {
          count: 1,
          components: [
            {
              typeName: 'ApexClass',
              componentName: 'MyClass',
              message: 'Only LWC supported',
            },
          ],
        },
      });
      MetricsFormatter.logMetrics(log, metrics, metricsMessages);
      expect(logLines.some((l) => l.includes('MyClass'))).to.be.true;
      expect(logLines.some((l) => l.includes('Only LWC supported') || l.includes('metrics.message'))).to.be.true;
    });

    it('should log fail count and component with message when present', () => {
      const logLines: string[] = [];
      const log = (msg: string) => logLines.push(msg);
      const metrics = createMetrics({
        total: 1,
        fail: {
          count: 1,
          components: [
            {
              typeName: 'LightningComponentBundle',
              componentName: 'BadCmp',
              message: 'Enrichment failed',
            },
          ],
        },
      });
      MetricsFormatter.logMetrics(log, metrics, metricsMessages);
      expect(logLines.some((l) => l.includes('BadCmp'))).to.be.true;
      expect(logLines.some((l) => l.includes('Enrichment failed') || l.includes('metrics.message'))).to.be.true;
    });
  });
});
