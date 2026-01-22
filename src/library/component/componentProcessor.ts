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
import type { MetadataTypeAndMetadataName } from '../common/index.js';

export class ComponentProcessor {
  /**
   * Returns the components that were requested for enrichment but not found in the project source.
   *
   * @param sourceComponents Array of source components in the project
   * @param metadataEntries Array of metadata entries in format "TYPE:NAME" requested by the user
   * @param projectDir Optional project directory path for RegistryAccess
   * @returns Array of missing components as MetadataTypeAndMetadataName
   */
  public static diffRequestedComponents(
    sourceComponents: SourceComponent[],
    metadataEntries: string[],
    projectDir?: string,
  ): MetadataTypeAndMetadataName[] {
    const requestedComponents = ComponentProcessor.parseRequestedComponents(metadataEntries, projectDir);
    const existingSourceComponentNames = ComponentProcessor.getExistingSourceComponentNames(sourceComponents);

    const missingComponents: MetadataTypeAndMetadataName[] = [];
    for (const requestedComponent of requestedComponents) {
      if (requestedComponent.componentName && !existingSourceComponentNames.has(requestedComponent.componentName)) {
        missingComponents.push(requestedComponent);
      }
    }

    return missingComponents;
  }

  /**
   * Parses metadata entries to extract requested component names and their types.
   * Filters out wildcard entries (no support for wildcard component names).
   */
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

      // Filter out wildcarded names
      if (parsed.componentName && parsed.componentName !== '*' && !parsed.componentName.includes('*')) {
        requestedComponents.add(parsed);
      }
    }

    return requestedComponents;
  }

  /**
   * Extracts component names from source components.
   */
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

  /**
   * Parses a metadata entry string into type and name, using RegistryAccess for validation.
   * Based on entryToTypeAndName from ComponentSetBuilder.
   */
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
