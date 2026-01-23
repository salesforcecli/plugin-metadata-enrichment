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

import { RegistryAccess, type SourceComponent } from '@salesforce/source-deploy-retrieve';
import type { ComponentEnrichmentStatus, MetadataTypeAndMetadataName } from '../library/common/index.js';

export class ComponentProcessor {
  public static getComponentsToSkip(
    sourceComponents: SourceComponent[],
    metadataEntries: string[],
    projectDir?: string,
  ): ComponentEnrichmentStatus[] {
    const requestedComponents = ComponentProcessor.parseRequestedComponents(metadataEntries, projectDir);
    const missingComponents = ComponentProcessor.diffRequestedComponents(sourceComponents, requestedComponents);
    const filteredComponents = ComponentProcessor.filterComponents(sourceComponents, requestedComponents);
    return [...missingComponents, ...filteredComponents];
  }

  private static diffRequestedComponents(
    sourceComponents: SourceComponent[],
    requestedComponents: Set<MetadataTypeAndMetadataName>,
  ): ComponentEnrichmentStatus[] {
    const existingSourceComponentNames = ComponentProcessor.getExistingSourceComponentNames(sourceComponents);
    const missingComponents: ComponentEnrichmentStatus[] = [];
    for (const requestedComponent of requestedComponents) {
      if (requestedComponent.componentName && !existingSourceComponentNames.has(requestedComponent.componentName)) {
        missingComponents.push({
          ...requestedComponent,
          message: 'Not found in source project',
        });
      }
    }

    return missingComponents;
  }

  private static filterComponents(
    sourceComponents: SourceComponent[],
    requestedComponents: Set<MetadataTypeAndMetadataName>,
  ): ComponentEnrichmentStatus[] {
    const sourceComponentMap = ComponentProcessor.createSourceComponentMap(sourceComponents);
    const filteredComponents: ComponentEnrichmentStatus[] = [];

    for (const requestedComponent of requestedComponents) {
      const sourceComponent = requestedComponent.componentName
        ? sourceComponentMap.get(requestedComponent.componentName)
        : undefined;

      // Filter out non-LWC components
      if (sourceComponent && sourceComponent.type?.name !== 'LightningComponentBundle') {
        filteredComponents.push({
          ...requestedComponent,
          message: 'Only Lightning Web Components are currently supported for enrichment',
        });
      }

      // Filter out LWC components that are missing the metadata xml file
      if (sourceComponent && sourceComponent.type?.name === 'LightningComponentBundle' && !sourceComponent.xml) {
        filteredComponents.push({
          ...requestedComponent,
          message: 'Lightning Web Component configuration file does not exist (*.js-meta.xml)',
        });
      }
    }

    return filteredComponents;
  }

  private static parseRequestedComponents(
    metadataEntries: string[],
    projectDir?: string,
  ): Set<MetadataTypeAndMetadataName> {
    const requestedComponents = new Set<MetadataTypeAndMetadataName>();

    for (const entry of metadataEntries) {
      const parsed = ComponentProcessor.parseMetadataEntry(entry, projectDir);
      if (!parsed) {
        continue;
      }

      // Ignore wildcarded component names
      if (parsed.componentName && parsed.componentName.includes('*')) {
        continue;
      }

      requestedComponents.add(parsed);
    }

    return requestedComponents;
  }

  private static getExistingSourceComponentNames(sourceComponents: SourceComponent[]): Set<string> {
    const existingSourceComponentNames = new Set<string>();

    for (const component of sourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (componentName) {
        existingSourceComponentNames.add(componentName);
      }
    }

    return existingSourceComponentNames;
  }

  private static createSourceComponentMap(sourceComponents: SourceComponent[]): Map<string, SourceComponent> {
    const componentMap = new Map<string, SourceComponent>();

    for (const component of sourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (componentName) {
        componentMap.set(componentName, component);
      }
    }

    return componentMap;
  }

  private static parseMetadataEntry(rawEntry: string, projectDir?: string): MetadataTypeAndMetadataName | null {
    try {
      const registry = new RegistryAccess(undefined, projectDir);
      // Split on the first colon, and then join the rest back together to support names that include colons
      const [typeName, ...nameParts] = rawEntry.split(':');
      const type = registry.getTypeByName(typeName.trim());
      const metadataName = nameParts.length > 0 ? nameParts.join(':').trim() : '*';
      return {
        type: type.name,
        componentName: metadataName === '*' ? undefined : metadataName,
      };
    } catch {
      return null;
    }
  }
}
