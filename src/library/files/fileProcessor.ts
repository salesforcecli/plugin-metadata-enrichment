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

import { readFile } from 'node:fs/promises';
import type { MetadataTypeAndMetadataName } from '../common/index.js';
import { getMimeTypeFromExtension } from '../enrichment/enrichmentHandler.js';

export type FileReadResult = {
  componentName: string;
  filePath: string;
  fileContents: string;
  mimeType: string;
};

/**
 * Processor for file operations
 */
export class FileProcessor {
  /**
   * Reads all files from components and groups them by component name
   */
  public static async readAndGroupComponentFiles(
    components: Iterable<{ fullName: string; walkContent: () => Iterable<string> }>,
  ): Promise<Map<string, FileReadResult[]>> {
    const fileReadPromises = Array.from(components).flatMap((component) =>
      FileProcessor.createFileReadPromisesForComponent(component),
    );
    const fileResults = await Promise.all(fileReadPromises);

    return FileProcessor.groupFilesByComponent(fileResults);
  }

  /**
   * Parses a metadata entry string into MetadataTypeAndMetadataName.
   *
   * @param entry Metadata entry string in format "TYPE:NAME"
   * @returns Parsed metadata entry or null if invalid format
   */
  public static parseEntry(entry: string): MetadataTypeAndMetadataName | null {
    const parts = entry.split(':');
    if (parts.length >= 2) {
      const type = parts[0].trim();
      const componentName = parts.slice(1).join(':').trim();
      return {
        type,
        componentName: componentName || undefined,
      };
    }
    return null;
  }

  /**
   * Reads a single file and returns its contents with metadata
   */
  private static async readFileWithMetadata(componentName: string, filePath: string): Promise<FileReadResult | null> {
    try {
      const fileContents = await readFile(filePath, 'utf-8');
      const mimeType = getMimeTypeFromExtension(filePath);

      return {
        componentName,
        filePath,
        fileContents,
        mimeType,
      };
    } catch {
      // Return null for errors - they will be filtered out during grouping
      return null;
    }
  }

  /**
   * Creates file read promises for all files in a component
   */
  private static createFileReadPromisesForComponent(component: {
    fullName: string;
    walkContent: () => Iterable<string>;
  }): Array<Promise<FileReadResult | null>> {
    const componentName = component.fullName;
    const filePaths = Array.from(component.walkContent());

    return filePaths.map((filePath) => FileProcessor.readFileWithMetadata(componentName, filePath));
  }

  /**
   * Groups file results by component name, filtering out errors (null results)
   */
  private static groupFilesByComponent(fileResults: Array<FileReadResult | null>): Map<string, FileReadResult[]> {
    const componentFilesMap = new Map<string, FileReadResult[]>();
    for (const result of fileResults) {
      if (result) {
        const existing = componentFilesMap.get(result.componentName) ?? [];
        componentFilesMap.set(result.componentName, [...existing, result]);
      }
    }
    return componentFilesMap;
  }
}
