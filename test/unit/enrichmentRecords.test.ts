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
import { EnrichmentRecords, EnrichmentStatus } from '@salesforce/metadata-enrichment';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import type { Messages } from '@salesforce/core';

function createSourceComponent(name: string, typeName: string): SourceComponent {
  return {
    fullName: name,
    name,
    type: { name: typeName },
  } as SourceComponent;
}

function createMockMessages(): Messages<string> {
  return {
    getMessage: (key: string, args?: string[]) => (args?.length ? `${key}[${args.join(',')}]` : key),
  } as Messages<string>;
}

describe('EnrichmentRecords', () => {
  const errorMessages = createMockMessages();

  describe('constructor', () => {
    it('should create NOT_PROCESSED records for each source component with type and name', () => {
      const source = [
        createSourceComponent('Cmp1', 'LightningComponentBundle'),
        createSourceComponent('Cmp2', 'LightningComponentBundle'),
      ];
      const records = new EnrichmentRecords(source, errorMessages);
      expect(records.recordSet.size).to.equal(2);
      const arr = Array.from(records.recordSet);
      expect(arr.every((r) => r.status === EnrichmentStatus.NOT_PROCESSED)).to.be.true;
      expect(arr.map((r) => r.componentName).sort()).to.deep.equal(['Cmp1', 'Cmp2']);
      expect(arr.every((r) => r.requestBody?.contentBundles?.length === 0)).to.be.true;
    });

    it('should set placeholder requestBody for each component (library sets real metadataType for processed components)', () => {
      const source = [createSourceComponent('MyLwc', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      const record = Array.from(records.recordSet)[0];
      expect(record.requestBody).to.not.be.null;
      expect(record.requestBody!.contentBundles).to.deep.equal([]);
      expect(record.requestBody!.metadataType).to.equal('Generic');
      expect(record.requestBody!.maxTokens).to.equal(50);
    });

    it('should not create record when component has no name', () => {
      const source = [{ fullName: undefined, name: undefined, type: { name: 'LWC' } }] as unknown as SourceComponent[];
      const records = new EnrichmentRecords(source, errorMessages);
      expect(records.recordSet.size).to.equal(0);
    });

    it('should not create record when component has no type', () => {
      const source = [{ fullName: 'NoType', name: 'NoType', type: undefined }] as unknown as SourceComponent[];
      const records = new EnrichmentRecords(source, errorMessages);
      expect(records.recordSet.size).to.equal(0);
    });
  });

  describe('addSkippedComponents', () => {
    it('should add SKIPPED record for component not in recordSet', () => {
      const records = new EnrichmentRecords([], errorMessages);
      records.addSkippedComponents(new Set([{ typeName: 'LightningComponentBundle', componentName: 'SkippedCmp' }]));
      expect(records.recordSet.size).to.equal(1);
      const record = Array.from(records.recordSet)[0];
      expect(record.componentName).to.equal('SkippedCmp');
      expect(record.status).to.equal(EnrichmentStatus.SKIPPED);
      expect(record.requestBody).to.not.be.null;
      expect(record.requestBody!.contentBundles).to.deep.equal([]);
      expect(record.requestBody!.metadataType).to.equal('Generic');
      expect(record.requestBody!.maxTokens).to.equal(50);
    });

    it('should not duplicate when record already exists', () => {
      const source = [createSourceComponent('Existing', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.addSkippedComponents(new Set([{ typeName: 'LightningComponentBundle', componentName: 'Existing' }]));
      expect(records.recordSet.size).to.equal(1);
    });
  });

  describe('updateWithStatus', () => {
    it('should set status for matching records', () => {
      const source = [createSourceComponent('Cmp1', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.updateWithStatus(
        new Set([{ typeName: 'LightningComponentBundle', componentName: 'Cmp1' }]),
        EnrichmentStatus.SKIPPED
      );
      const record = Array.from(records.recordSet)[0];
      expect(record.status).to.equal(EnrichmentStatus.SKIPPED);
    });
  });

  describe('updateWithResults', () => {
    it('should replace record requestBody with result requestBody (library-supplied metadataType/maxTokens)', () => {
      const source = [createSourceComponent('Cmp1', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      const libraryRequestBody = {
        contentBundles: [{ resourceName: 'Cmp1', files: {} }],
        metadataType: 'Lwc' as const,
        maxTokens: 50,
      };
      records.updateWithResults([
        {
          componentName: 'Cmp1',
          componentType: { name: 'LightningComponentBundle' } as SourceComponent['type'],
          requestBody: libraryRequestBody,
          response: { metadata: { durationMs: 0, failureCount: 0, successCount: 1, timestamp: '' }, results: [] },
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
      ]);
      const record = Array.from(records.recordSet)[0];
      expect(record.requestBody).to.equal(libraryRequestBody);
      expect(record.requestBody).to.not.be.null;
      expect(record.requestBody!.metadataType).to.equal('Lwc');
      expect(record.requestBody!.maxTokens).to.equal(50);
    });

    it('should update record to SUCCESS when response is present', () => {
      const source = [createSourceComponent('Cmp1', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.updateWithResults([
        {
          componentName: 'Cmp1',
          componentType: { name: 'LightningComponentBundle' } as SourceComponent['type'],
          requestBody: { contentBundles: [], metadataType: 'Generic', maxTokens: 50 },
          response: {
            metadata: { durationMs: 0, failureCount: 0, successCount: 1, timestamp: '' },
            results: [],
          },
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
      ]);
      const record = Array.from(records.recordSet)[0];
      expect(record.status).to.equal(EnrichmentStatus.SUCCESS);
      expect(record.response).to.not.be.null;
    });

    it('should update record to FAIL when response is null', () => {
      const source = [createSourceComponent('Cmp1', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.updateWithResults([
        {
          componentName: 'Cmp1',
          componentType: { name: 'LightningComponentBundle' } as SourceComponent['type'],
          requestBody: { contentBundles: [], metadataType: 'Generic', maxTokens: 50 },
          response: null,
          message: 'error',
          status: EnrichmentStatus.FAIL,
        },
      ]);
      const record = Array.from(records.recordSet)[0];
      expect(record.status).to.equal(EnrichmentStatus.FAIL);
      expect(record.message).to.equal('error');
    });

    it('should not override status when record is SKIPPED', () => {
      const source = [createSourceComponent('Cmp1', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.updateWithStatus(
        new Set([{ typeName: 'LightningComponentBundle', componentName: 'Cmp1' }]),
        EnrichmentStatus.SKIPPED
      );
      records.updateWithResults([
        {
          componentName: 'Cmp1',
          componentType: { name: 'LightningComponentBundle' } as SourceComponent['type'],
          requestBody: { contentBundles: [], metadataType: 'Generic', maxTokens: 50 },
          response: {
            metadata: { durationMs: 0, failureCount: 0, successCount: 1, timestamp: '' },
            results: [],
          },
          message: null,
          status: EnrichmentStatus.SUCCESS,
        },
      ]);
      const record = Array.from(records.recordSet)[0];
      expect(record.status).to.equal(EnrichmentStatus.SKIPPED);
    });
  });

  describe('generateSkipReasons', () => {
    it('should set message for skipped record when component not in source', () => {
      const records = new EnrichmentRecords([], errorMessages);
      records.addSkippedComponents(new Set([{ typeName: 'LightningComponentBundle', componentName: 'Missing' }]));
      records.generateSkipReasons(new Set([{ typeName: 'LightningComponentBundle', componentName: 'Missing' }]), []);
      const record = Array.from(records.recordSet)[0];
      expect(record.message).to.equal('errors.component.not.found');
    });

    it('should set LWC-only message for skipped non-LWC component', () => {
      const source = [createSourceComponent('MyClass', 'ApexClass')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.addSkippedComponents(new Set([{ typeName: 'ApexClass', componentName: 'MyClass' }]));
      records.updateWithStatus(
        new Set([{ typeName: 'ApexClass', componentName: 'MyClass' }]),
        EnrichmentStatus.SKIPPED
      );
      records.generateSkipReasons(new Set([{ typeName: 'ApexClass', componentName: 'MyClass' }]), source);
      const record = Array.from(records.recordSet)[0];
      expect(record.message).to.equal('errors.lwc.only');
    });

    it('should set lwc.configuration.not.found for LWC without xml', () => {
      const source = [createSourceComponent('NoMeta', 'LightningComponentBundle')];
      const records = new EnrichmentRecords(source, errorMessages);
      records.addSkippedComponents(new Set([{ typeName: 'LightningComponentBundle', componentName: 'NoMeta' }]));
      records.updateWithStatus(
        new Set([{ typeName: 'LightningComponentBundle', componentName: 'NoMeta' }]),
        EnrichmentStatus.SKIPPED
      );
      records.generateSkipReasons(new Set([{ typeName: 'LightningComponentBundle', componentName: 'NoMeta' }]), source);
      const record = Array.from(records.recordSet)[0];
      expect(record.message).to.equal('errors.lwc.configuration.not.found');
    });
  });
});
