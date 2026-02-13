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
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { ComponentProcessor } from '@salesforce/metadata-enrichment';

function createSourceComponent(name: string, typeName: string, options?: { xml?: string }): SourceComponent {
  return {
    fullName: name,
    name,
    type: { name: typeName },
    xml: options?.xml,
  } as SourceComponent;
}

describe('ComponentProcessor', () => {
  describe('getComponentsToSkip', () => {
    it('should return empty set when sourceComponents and metadataEntries are empty', () => {
      const result = ComponentProcessor.getComponentsToSkip([], [], undefined);
      expect(result.size).to.equal(0);
    });

    it('should return empty set when requested LWC exists in source with xml', () => {
      const source = [createSourceComponent('MyCmp', 'LightningComponentBundle', { xml: 'mycmp.js-meta.xml' })];
      const result = ComponentProcessor.getComponentsToSkip(source, ['LightningComponentBundle:MyCmp'], undefined);
      expect(result.size).to.equal(0);
    });

    it('should include requested component when not in source (missing)', () => {
      const source = [createSourceComponent('OtherCmp', 'LightningComponentBundle', { xml: 'other.js-meta.xml' })];
      const result = ComponentProcessor.getComponentsToSkip(source, ['LightningComponentBundle:MissingCmp'], undefined);
      expect(result.size).to.be.greaterThan(0);
      const skipNames = Array.from(result).map((r) => r.componentName);
      expect(skipNames).to.include('MissingCmp');
    });

    it('should include non-LWC component in skip set', () => {
      const source = [createSourceComponent('MyClass', 'ApexClass')];
      const result = ComponentProcessor.getComponentsToSkip(source, ['ApexClass:MyClass'], undefined);
      expect(result.size).to.be.greaterThan(0);
      const skipEntries = Array.from(result);
      expect(skipEntries.some((r) => r.componentName === 'MyClass' && r.typeName === 'ApexClass')).to.be.true;
    });

    it('should include LWC without xml in skip set', () => {
      const source = [createSourceComponent('NoMetaCmp', 'LightningComponentBundle')];
      const result = ComponentProcessor.getComponentsToSkip(source, ['LightningComponentBundle:NoMetaCmp'], undefined);
      expect(result.size).to.be.greaterThan(0);
      expect(Array.from(result).some((r) => r.componentName === 'NoMetaCmp')).to.be.true;
    });

    it('should not include wildcard metadata entries in requested (no missing from wildcard)', () => {
      const source: SourceComponent[] = [];
      const result = ComponentProcessor.getComponentsToSkip(source, ['LightningComponentBundle:*'], undefined);
      expect(result.size).to.equal(0);
    });
  });
});
