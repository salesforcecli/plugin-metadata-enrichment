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
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import * as ComponentSetBuilder from '@salesforce/source-deploy-retrieve';
import * as MetadataEnrichment from '@salesforce/metadata-enrichment';
import * as SfProject from '@salesforce/core';
import type { ComponentEnrichmentStatus } from '@salesforce/metadata-enrichment';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import EnrichMetadata from '../../../src/commands/enrich/metadata.js';

describe('enrich metadata', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();
  testOrg.isScratchOrg = true;

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
    await $$.stubConfig({ 'target-org': testOrg.username });
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should successfully enrich metadata components', async () => {
    const mockComponent = {
      fullName: 'TestComponent',
      name: 'TestComponent',
      type: { name: 'LightningComponentBundle' },
      xml: { path: 'test.xml' },
    };

    $$.SANDBOX.stub(ComponentSetBuilder, 'ComponentSetBuilder').value({
      build: async () => ({
        getSourceComponents: () => ({
          toArray: () => [mockComponent],
        }),
      }),
    });

    $$.SANDBOX.stub(SfProject, 'SfProject').value({
      resolve: async () => ({
        getPath: () => '/test/path',
      }),
    });

    const mockConnection = {} as unknown as Awaited<ReturnType<typeof testOrg.getConnection>>;
    $$.SANDBOX.stub(testOrg, 'getConnection').resolves(mockConnection);

    const mockEnrichmentResults: ComponentEnrichmentStatus[] = [
      {
        type: 'LightningComponentBundle',
        componentName: 'TestComponent',
        message: 'Success',
      },
    ];

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentHandler').value({
      enrich: async () => mockEnrichmentResults,
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'FileProcessor').value({
      updateMetadataFiles: async (_components: SourceComponent[], results: ComponentEnrichmentStatus[]) => results,
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentMetrics').value({
      createEnrichmentMetrics: (results: ComponentEnrichmentStatus[], skipped: ComponentEnrichmentStatus[]) => ({
        total: 1,
        success: { count: 1, components: results },
        skipped: { count: skipped.length, components: skipped },
        fail: { count: 0, components: [] },
      }),
    });

    const result = await EnrichMetadata.run(['--metadata', 'LightningComponentBundle:TestComponent']);

    expect(result.total).to.equal(1);
    expect(result.success.count).to.equal(1);
    expect(result.success.components[0].componentName).to.equal('TestComponent');
  });

  it('should skip non-LWC components', async () => {
    const mockComponent = {
      fullName: 'TestApex',
      name: 'TestApex',
      type: { name: 'ApexClass' },
    };

    $$.SANDBOX.stub(ComponentSetBuilder, 'ComponentSetBuilder').value({
      build: async () => ({
        getSourceComponents: () => ({
          toArray: () => [mockComponent],
        }),
      }),
    });

    $$.SANDBOX.stub(SfProject, 'SfProject').value({
      resolve: async () => ({
        getPath: () => '/test/path',
      }),
    });

    const mockConnection = {} as unknown as Awaited<ReturnType<typeof testOrg.getConnection>>;
    $$.SANDBOX.stub(testOrg, 'getConnection').resolves(mockConnection);

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentHandler').value({
      enrich: async () => [],
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'FileProcessor').value({
      updateMetadataFiles: async (_components: SourceComponent[], results: ComponentEnrichmentStatus[]) => results,
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentMetrics').value({
      createEnrichmentMetrics: (_results: ComponentEnrichmentStatus[], skipped: ComponentEnrichmentStatus[]) => ({
        total: 1,
        success: { count: 0, components: [] },
        skipped: { count: skipped.length, components: skipped },
        fail: { count: 0, components: [] },
      }),
    });

    const result = await EnrichMetadata.run(['--metadata', 'ApexClass:TestApex']);

    expect(result.skipped.count).to.equal(1);
    expect(result.skipped.components[0].message).to.include('Only Lightning Web Components');
  });

  it('should skip missing components', async () => {
    $$.SANDBOX.stub(ComponentSetBuilder, 'ComponentSetBuilder').value({
      build: async () => ({
        getSourceComponents: () => ({
          toArray: () => [],
        }),
      }),
    });

    $$.SANDBOX.stub(SfProject, 'SfProject').value({
      resolve: async () => ({
        getPath: () => '/test/path',
      }),
    });

    const mockConnection = {} as unknown as Awaited<ReturnType<typeof testOrg.getConnection>>;
    $$.SANDBOX.stub(testOrg, 'getConnection').resolves(mockConnection);

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentHandler').value({
      enrich: async () => [],
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'FileProcessor').value({
      updateMetadataFiles: async (_components: SourceComponent[], results: ComponentEnrichmentStatus[]) => results,
    });

    $$.SANDBOX.stub(MetadataEnrichment, 'EnrichmentMetrics').value({
      createEnrichmentMetrics: (_results: ComponentEnrichmentStatus[], skipped: ComponentEnrichmentStatus[]) => ({
        total: 1,
        success: { count: 0, components: [] },
        skipped: { count: skipped.length, components: skipped },
        fail: { count: 0, components: [] },
      }),
    });

    const result = await EnrichMetadata.run(['--metadata', 'LightningComponentBundle:MissingComponent']);

    expect(result.skipped.count).to.equal(1);
    expect(result.skipped.components[0].message).to.include('Not found in source project');
  });
});
