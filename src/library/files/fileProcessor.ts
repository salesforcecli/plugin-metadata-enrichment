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

import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { SfError } from '@salesforce/core';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { EnrichmentRequestRecord, EnrichmentResult } from '../enrichment/enrichmentHandler.js';
import { getMimeTypeFromExtension } from '../enrichment/enrichmentHandler.js';

export type FileReadResult = {
  componentName: string;
  filePath: string;
  fileContents: string;
  mimeType: string;
};

export class FileProcessor {
  public static async updateMetadataFiles(
    sourceComponents: SourceComponent[],
    enrichmentRecords: EnrichmentRequestRecord[],
  ): Promise<EnrichmentRequestRecord[]> {
    const fileContents = await FileProcessor.readComponentXmlFilesInParallel(sourceComponents);

    for (const file of fileContents) {
      if (!FileProcessor.isMetaXmlFile(file.filePath)) {
        continue;
      }

      const enrichmentRecord = enrichmentRecords.find((record) => record.componentName === file.componentName);
      if (!enrichmentRecord?.response) {
        continue;
      }

      const enrichmentResult = enrichmentRecord.response.results[0];
      if (!enrichmentResult) {
        continue;
      }

      try {
        const updatedXml = FileProcessor.updateMetaXml(file.fileContents, enrichmentResult);
        // eslint-disable-next-line no-await-in-loop
        await writeFile(file.filePath, updatedXml, 'utf-8');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        enrichmentRecord.message = errorMessage;
      }
    }

    return enrichmentRecords;
  }

  public static async readFileMetadata(componentName: string, filePath: string): Promise<FileReadResult | null> {
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
      return null;
    }
  }

  public static async readComponentFiles(component: SourceComponent): Promise<FileReadResult[]> {
    const componentName = component.fullName ?? component.name;
    if (!componentName) {
      return [];
    }

    const filePaths = Array.from(component.walkContent());
    const fileReadPromises = filePaths.map((filePath) => FileProcessor.readFileMetadata(componentName, filePath));

    const fileResults = await Promise.all(fileReadPromises);
    return fileResults.filter((result): result is FileReadResult => result !== null);
  }

  // Assumption - usages of this function are all for LWC
  private static async readComponentXmlFilesInParallel(sourceComponents: SourceComponent[]): Promise<FileReadResult[]> {
    const fileReadPromises: Array<Promise<FileReadResult | null>> = [];

    for (const component of sourceComponents) {
      const componentName = component.fullName ?? component.name;
      if (!componentName || !component.xml) {
        continue;
      }

      fileReadPromises.push(FileProcessor.readFileMetadata(componentName, component.xml));
    }

    const fileResults = await Promise.all(fileReadPromises);
    return fileResults.filter((result): result is FileReadResult => result !== null);
  }

  private static isMetaXmlFile(filePath: string): boolean {
    const fileName = basename(filePath);
    return fileName.endsWith('.js-meta.xml');
  }

  private static updateMetaXml(xmlContent: string, result: EnrichmentResult): string {
    const parser = new XMLParser({
      ignoreAttributes: false,
      preserveOrder: false,
      trimValues: true,
    });
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    });

    try {
      const xmlObj = parser.parse(xmlContent) as {
        LightningComponentBundle?: {
          ai?: {
            skipUplift?: string | boolean;
            description?: string;
            score?: string;
          };
        };
      };

      const ai = xmlObj.LightningComponentBundle?.ai;

      // Do not update if skipUplift is set to true
      const skipUpliftValue = ai?.skipUplift;
      if (skipUpliftValue === true || String(skipUpliftValue).toLowerCase() === 'true') {
        return xmlContent;
      }

      if (!xmlObj.LightningComponentBundle) {
        xmlObj.LightningComponentBundle = {};
      }

      xmlObj.LightningComponentBundle.ai = {
        skipUplift: 'false',
        description: result.description,
        score: String(result.descriptionScore),
      };

      const builtXml = builder.build(xmlObj) as string;
      return builtXml.trim().replace(/\n{3,}/g, '\n\n');
    } catch (error) {
      throw new SfError(`Failed to parse XML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
