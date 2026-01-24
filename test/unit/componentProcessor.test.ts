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
import { ComponentProcessor } from '../../src/utils/componentProcessor.js';

describe('ComponentProcessor', () => {
  describe('getComponentsToSkip', () => {
    it('should skip non-LWC components', () => {
      const sourceComponents: SourceComponent[] = [
        {
          fullName: 'TestApex',
          name: 'TestApex',
          type: { name: 'ApexClass' },
        } as unknown as SourceComponent,
      ];

      const result = ComponentProcessor.getComponentsToSkip(sourceComponents, ['ApexClass:TestApex'], '/test/path');

      expect(result).to.have.length(1);
      expect(result[0].type).to.equal('ApexClass');
      expect(result[0].componentName).to.equal('TestApex');
      expect(result[0].message).to.include('Only Lightning Web Components');
    });

    it('should skip LWC components missing XML file', () => {
      const sourceComponents: SourceComponent[] = [
        {
          fullName: 'TestComponent',
          name: 'TestComponent',
          type: { name: 'LightningComponentBundle' },
          xml: undefined,
        } as unknown as SourceComponent,
      ];

      const result = ComponentProcessor.getComponentsToSkip(
        sourceComponents,
        ['LightningComponentBundle:TestComponent'],
        '/test/path',
      );

      expect(result).to.have.length(1);
      expect(result[0].type).to.equal('LightningComponentBundle');
      expect(result[0].componentName).to.equal('TestComponent');
      expect(result[0].message).to.include('configuration file does not exist');
    });

    it('should skip missing components', () => {
      const sourceComponents: SourceComponent[] = [];

      const result = ComponentProcessor.getComponentsToSkip(
        sourceComponents,
        ['LightningComponentBundle:MissingComponent'],
        '/test/path',
      );

      expect(result).to.have.length(1);
      expect(result[0].type).to.equal('LightningComponentBundle');
      expect(result[0].componentName).to.equal('MissingComponent');
      expect(result[0].message).to.include('Not found in source project');
    });

    it('should not skip valid LWC components with XML', () => {
      const sourceComponents: SourceComponent[] = [
        {
          fullName: 'ValidComponent',
          name: 'ValidComponent',
          type: { name: 'LightningComponentBundle' },
          xml: { path: 'test.xml' },
        } as unknown as SourceComponent,
      ];

      const result = ComponentProcessor.getComponentsToSkip(
        sourceComponents,
        ['LightningComponentBundle:ValidComponent'],
        '/test/path',
      );

      expect(result).to.have.length(0);
    });

    it('should handle multiple components', () => {
      const sourceComponents: SourceComponent[] = [
        {
          fullName: 'ValidComponent',
          name: 'ValidComponent',
          type: { name: 'LightningComponentBundle' },
          xml: { path: 'test.xml' },
        } as unknown as SourceComponent,
        {
          fullName: 'InvalidApex',
          name: 'InvalidApex',
          type: { name: 'ApexClass' },
        } as unknown as SourceComponent,
      ];

      const result = ComponentProcessor.getComponentsToSkip(
        sourceComponents,
        ['LightningComponentBundle:ValidComponent', 'ApexClass:InvalidApex'],
        '/test/path',
      );

      expect(result).to.have.length(1);
      expect(result[0].componentName).to.equal('InvalidApex');
    });

    it('should ignore wildcarded component names', () => {
      const sourceComponents: SourceComponent[] = [];

      const result = ComponentProcessor.getComponentsToSkip(
        sourceComponents,
        ['LightningComponentBundle:*'],
        '/test/path',
      );

      expect(result).to.have.length(0);
    });
  });
});
