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

import { basename, extname } from 'node:path';
import type { Connection } from '@salesforce/core';
import { SfError } from '@salesforce/core';
import type { MetadataType, SourceComponent } from '@salesforce/source-deploy-retrieve';
import { FileProcessor } from '../files/index.js';
import type { FileReadResult } from '../files/index.js';
import { ENDPOINT_ENRICHMENT, MIME_TYPES } from './constants.js';

export type ContentBundleFile = {
  filename: string;
  mimeType: string;
  content: string;
  encoding: 'PlainText';
};

export type ContentBundle = {
  resourceName: string;
  files: Record<string, ContentBundleFile>;
};

export type EnrichmentRequestBody = {
  contentBundles: ContentBundle[];
  metadataType: 'Generic';
  maxTokens: 250;
};

export type EnrichmentMetadata = {
  durationMs: number;
  failureCount: number;
  successCount: number;
  timestamp: string;
};

export type EnrichmentResult = {
  resourceId: string;
  resourceName: string;
  metadataType: string;
  modelUsed: string;
  description: string;
  descriptionScore: number;
};

export type EnrichMetadataResult = {
  metadata: EnrichmentMetadata;
  results: EnrichmentResult[];
};

export type EnrichmentRequestRecord = {
  componentName: string;
  componentType: MetadataType;
  requestBody: EnrichmentRequestBody;
  response: EnrichMetadataResult | null;
  message: string | null;
};

export function getMimeTypeFromExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export class EnrichmentHandler {
  /**
   * Processes and sends metadata enrichment requests for the input source components in the project.
   *
   * @param connection Salesforce connection instance
   * @param sourceComponents Array of source components to enrich
   * @returns Promise resolving to enrichment request records
   */
  public static async enrich(
    connection: Connection,
    sourceComponents: SourceComponent[],
  ): Promise<EnrichmentRequestRecord[]> {
    const records = await EnrichmentHandler.createEnrichmentRequestRecords(sourceComponents);
    return EnrichmentHandler.sendEnrichmentRequests(connection, records);
  }

  private static async createEnrichmentRequestRecords(
    components: SourceComponent[],
  ): Promise<EnrichmentRequestRecord[]> {
    const recordPromises = components.map(async (component): Promise<EnrichmentRequestRecord | null> => {
      const componentName = component.fullName ?? component.name;
      if (!componentName) {
        return null;
      }

      const files = await FileProcessor.readComponentFiles(component);
      if (files.length === 0) {
        return null;
      }

      const contentBundle = EnrichmentHandler.createContentBundle(componentName, files);
      const requestBody = EnrichmentHandler.createEnrichmentRequestBody(contentBundle);

      return {
        componentName,
        componentType: component.type ?? null,
        requestBody,
        response: null,
        message: null,
      };
    });

    const results = await Promise.all(recordPromises);
    const validRecords: EnrichmentRequestRecord[] = [];
    for (const record of results) {
      if (record !== null) {
        validRecords.push(record);
      }
    }
    return validRecords;
  }

  /**
   * Creates a ContentBundleFile from file read results
   */
  private static createContentBundleFile(file: FileReadResult): ContentBundleFile {
    return {
      filename: basename(file.filePath),
      mimeType: file.mimeType,
      content: file.fileContents,
      encoding: 'PlainText',
    };
  }

  /**
   * Creates a ContentBundle from a component name and its files
   */
  private static createContentBundle(componentName: string, files: FileReadResult[]): ContentBundle {
    const contentBundleFiles: Record<string, ContentBundleFile> = {};

    for (const file of files) {
      const contentBundleFile = EnrichmentHandler.createContentBundleFile(file);
      contentBundleFiles[contentBundleFile.filename] = contentBundleFile;
    }

    return {
      resourceName: componentName,
      files: contentBundleFiles,
    };
  }

  /**
   * Creates an EnrichmentRequestBody from a ContentBundle
   */
  private static createEnrichmentRequestBody(contentBundle: ContentBundle): EnrichmentRequestBody {
    return {
      contentBundles: [contentBundle],
      metadataType: 'Generic',
      maxTokens: 250,
    };
  }

  /**
   * Sends a single enrichment request and returns the record with response populated.
   *
   * @param connection Salesforce connection instance
   * @param record The enrichment request record
   * @returns Promise resolving to enrichment request record with response
   */
  private static async sendEnrichmentRequest(
    connection: Connection,
    record: EnrichmentRequestRecord,
  ): Promise<EnrichmentRequestRecord> {
    try {
      const response: EnrichMetadataResult = await connection.requestPost(ENDPOINT_ENRICHMENT, record.requestBody);
      return {
        ...record,
        response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SfError(`Error sending request for component ${record.componentName}: ${errorMessage}`);
    }
  }

  /**
   * Sends enrichment requests for all records in parallel.
   *
   * @param connection Salesforce connection instance
   * @param records Array of enrichment request records
   * @returns Promise resolving to array of enrichment request records with responses populated
   */
  private static async sendEnrichmentRequests(
    connection: Connection,
    records: EnrichmentRequestRecord[],
  ): Promise<EnrichmentRequestRecord[]> {
    const requestPromises = records.map((record) => EnrichmentHandler.sendEnrichmentRequest(connection, record));

    const requestResults = await Promise.allSettled(requestPromises);

    return requestResults.map((result, index) => {
      // If the request was successful, return the record with the response populated
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // If the request was not successful, capture the error message
      const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      return {
        ...records[index],
        response: null,
        message: errorMessage,
      };
    });
  }
}
