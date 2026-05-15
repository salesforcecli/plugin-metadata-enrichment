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

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { SourceTestkit } from '@salesforce/source-testkit';
import type { EnrichmentMetrics } from '@salesforce/metadata-enrichment';

const REPO = 'https://github.com/trailheadapps/dreamhouse-lwc.git';
const SAMPLE_LWC = 'LightningComponentBundle:propertyCard'; // LWC from dreamhouse-lwc

describe('metadata enrich NUTs', () => {
  let testkit: SourceTestkit;

  before(async () => {
    testkit = await SourceTestkit.create({
      repository: REPO,
      nut: fileURLToPath(import.meta.url),
    });
  });

  after(async () => {
    await testkit?.clean();
  });

  const runEnrich = (args: string, options?: { ensureExitCode?: number }) =>
    execCmd(`metadata enrich ${args}`, {
      cwd: testkit.projectDir,
      ...options,
    });

  describe('--help', () => {
    it('should show help with summary and metadata flag', () => {
      const result = runEnrich('--help', { ensureExitCode: 0 });
      expect(result.shellOutput.stdout).to.include('Enrich metadata');
      expect(result.shellOutput.stdout).to.match(/-m.*--metadata/);
    });
  });

  describe('required flags', () => {
    it('should fail when metadata flag is missing', () => {
      const result = runEnrich(`--target-org ${testkit.username}`, { ensureExitCode: 2 });
      expect(result.shellOutput.stderr).to.include('Missing required flag');
    });

    it('should use default org when target-org is omitted', () => {
      const result = runEnrich(`--metadata ${SAMPLE_LWC}`, { ensureExitCode: 0 });
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });
  });

  describe('--metadata flag', () => {
    it('should accept metadata flag with LightningComponentBundle', () => {
      const result = runEnrich(`--target-org ${testkit.username} --metadata ${SAMPLE_LWC}`);
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });

    it('should accept multiple metadata entries', () => {
      const result = runEnrich(
        `--target-org ${testkit.username} --metadata ${SAMPLE_LWC} LightningComponentBundle:propertySummary`
      );
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });

    it('should accept -m short flag', () => {
      const result = runEnrich(`--target-org ${testkit.username} -m ${SAMPLE_LWC}`);
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });
  });

  describe('error scenarios', () => {
    it('should fail when target-org is invalid or not authorized', () => {
      const result = runEnrich(`--target-org NoSuchOrg@example.com --metadata ${SAMPLE_LWC}`, { ensureExitCode: 2 });
      expect(result.shellOutput.stderr).to.include('NamedOrgNotFoundError');
    });
  });

  describe('--json', () => {
    it('should output metrics-shaped JSON when --json is used and command runs', () => {
      const result = runEnrich(`--target-org ${testkit.username} --metadata ${SAMPLE_LWC} --json`);
      const output = result.jsonOutput as Record<string, unknown> | undefined;
      const metrics = output?.result as Record<string, unknown> | undefined;
      if (metrics && typeof metrics === 'object') {
        expect(metrics).to.have.nested.property('success.count');
        expect(metrics).to.have.nested.property('skipped.count');
        expect(metrics).to.have.nested.property('fail.count');
        expect(metrics).to.have.property('total');
      }
    });

    it('should return status 0 and counts that sum to total', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${SAMPLE_LWC} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      const { jsonOutput } = result;
      expect(jsonOutput).to.exist;
      expect(jsonOutput!.status).to.equal(0);
      const metrics = jsonOutput!.result;
      expect(metrics.total).to.be.a('number').and.greaterThan(0);
      expect(metrics.success.count + metrics.skipped.count + metrics.fail.count).to.equal(metrics.total);
    });

    it('should include typeName, componentName, and requestId on each success component', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${SAMPLE_LWC} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      for (const component of result.jsonOutput!.result.success.components) {
        expect(component).to.have.property('typeName').that.is.a('string').and.is.not.empty;
        expect(component).to.have.property('componentName').that.is.a('string').and.is.not.empty;
        expect(component).to.have.property('requestId').that.matches(/^req-/);
      }
    });

    it('should return status 2 and a NamedOrgNotFoundError for an invalid org', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org NoSuchOrg@example.com --metadata ${SAMPLE_LWC} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 2 }
      );
      expect(result.jsonOutput).to.exist;
      expect(result.jsonOutput!.status).to.equal(2);
      expect(result.jsonOutput!.name).to.equal('NamedOrgNotFoundError');
    });
  });

  describe('single-component enrichment', () => {
    const SINGLE_LWC = 'LightningComponentBundle:barcodeScanner';
    const SINGLE_LWC_NAME = 'barcodeScanner';

    it('should successfully enrich a single component and report correct human output', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${SINGLE_LWC}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include(SINGLE_LWC_NAME);
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );
    });

    it('should successfully enrich a single component and return correct JSON output', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${SINGLE_LWC} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      expect(result.jsonOutput!.status).to.equal(0);
      const { total, success, skipped, fail } = result.jsonOutput!.result;
      expect(total).to.equal(1);
      expect(success.count).to.equal(1);
      expect(skipped.count).to.equal(0);
      expect(fail.count).to.equal(0);
      expect(success.components).to.have.lengthOf(1);
      const [component] = success.components;
      expect(component.typeName).to.equal('LightningComponentBundle');
      expect(component.componentName).to.equal(SINGLE_LWC_NAME);
      expect(component.requestId, 'expected requestId to be a req- prefixed string (e.g. req-0514-Ujt7QQs1)').to.match(
        /^req-/
      );
    });
  });

  describe('wildcard component enrichment', () => {
    const WILDCARD_METADATA = '"LightningComponentBundle:propertyTile*"';
    const EXPECTED_COMPONENTS = ['propertyTile', 'propertyTileList'];

    it('should successfully enrich all wildcard-matched components and report correct human output', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${WILDCARD_METADATA}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 2');
      expect(stdout).to.include('LightningComponentBundle');
      for (const name of EXPECTED_COMPONENTS) {
        expect(stdout).to.include(name);
      }
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );
    });

    it('should successfully enrich all wildcard-matched components and return correct JSON output', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${WILDCARD_METADATA} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      expect(result.jsonOutput!.status).to.equal(0);
      const { total, success, skipped, fail } = result.jsonOutput!.result;
      expect(total).to.equal(2);
      expect(success.count).to.equal(2);
      expect(skipped.count).to.equal(0);
      expect(fail.count).to.equal(0);
      expect(success.components).to.have.lengthOf(2);
      const componentNames = success.components.map((c) => c.componentName);
      expect(componentNames).to.have.members(EXPECTED_COMPONENTS);
      for (const component of success.components) {
        expect(component.typeName).to.equal('LightningComponentBundle');
        expect(
          component.requestId,
          'expected requestId to be a req- prefixed string (e.g. req-0514-Ujt7QQs1)'
        ).to.match(/^req-/);
      }
    });
  });

  describe('multiple explicit components enrichment', () => {
    const COMPONENTS = ['barcodeScanner', 'daysOnMarket', 'paginator'];
    const METADATA_FLAGS = COMPONENTS.map((c) => `--metadata LightningComponentBundle:${c}`).join(' ');

    it('should successfully enrich multiple explicit components and report correct human output', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} ${METADATA_FLAGS}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 3');
      expect(stdout).to.include('LightningComponentBundle');
      for (const name of COMPONENTS) {
        expect(stdout).to.include(name);
      }
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );
    });

    it('should successfully enrich multiple explicit components and return correct JSON output', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} ${METADATA_FLAGS} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      expect(result.jsonOutput!.status).to.equal(0);
      const { total, success, skipped, fail } = result.jsonOutput!.result;
      expect(total).to.equal(3);
      expect(success.count).to.equal(3);
      expect(skipped.count).to.equal(0);
      expect(fail.count).to.equal(0);
      expect(success.components).to.have.lengthOf(3);
      const componentNames = success.components.map((c) => c.componentName);
      expect(componentNames).to.have.members(COMPONENTS);
      for (const component of success.components) {
        expect(component.typeName).to.equal('LightningComponentBundle');
        expect(
          component.requestId,
          'expected requestId to be a req- prefixed string (e.g. req-0514-Ujt7QQs1)'
        ).to.match(/^req-/);
      }
    });
  });

  describe('file update verification', () => {
    const COMPONENT = 'LightningComponentBundle:barcodeScanner';
    const COMPONENT_NAME = 'barcodeScanner';
    const META_XML_PATH = join('force-app', 'main', 'default', 'lwc', COMPONENT_NAME, `${COMPONENT_NAME}.js-meta.xml`);

    it('should report correct human output and update the .js-meta.xml with an <ai> tag', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include(COMPONENT_NAME);
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );

      const xmlContent = readFileSync(join(testkit.projectDir, META_XML_PATH), 'utf-8');
      expect(xmlContent).to.include('<ai>');
      expect(xmlContent).to.include('</ai>');
      expect(xmlContent, 'expected <description> inside <ai> tag').to.match(
        /<ai>[\s\S]*<description>[\s\S]*<\/description>[\s\S]*<\/ai>/
      );
      expect(xmlContent, 'expected <descriptionScore> inside <ai> tag').to.match(
        /<ai>[\s\S]*<descriptionScore>[\s\S]*<\/descriptionScore>[\s\S]*<\/ai>/
      );
    });

    it('should return correct JSON output and update the .js-meta.xml with an <ai> tag', () => {
      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      expect(result.jsonOutput!.status).to.equal(0);
      const { total, success, skipped, fail } = result.jsonOutput!.result;
      expect(total).to.equal(1);
      expect(success.count).to.equal(1);
      expect(skipped.count).to.equal(0);
      expect(fail.count).to.equal(0);
      expect(success.components).to.have.lengthOf(1);
      const [component] = success.components;
      expect(component.typeName).to.equal('LightningComponentBundle');
      expect(component.componentName).to.equal(COMPONENT_NAME);
      expect(component.requestId, 'expected requestId to be a req- prefixed string (e.g. req-0514-Ujt7QQs1)').to.match(
        /^req-/
      );

      const xmlContent = readFileSync(join(testkit.projectDir, META_XML_PATH), 'utf-8');
      expect(xmlContent).to.include('<ai>');
      expect(xmlContent).to.include('</ai>');
      expect(xmlContent, 'expected <description> inside <ai> tag').to.match(
        /<ai>[\s\S]*<description>[\s\S]*<\/description>[\s\S]*<\/ai>/
      );
      expect(xmlContent, 'expected <descriptionScore> inside <ai> tag').to.match(
        /<ai>[\s\S]*<descriptionScore>[\s\S]*<\/descriptionScore>[\s\S]*<\/ai>/
      );
    });
  });

  describe('re-enrichment after <ai> tag removal', () => {
    const COMPONENT = 'LightningComponentBundle:barcodeScanner';
    const COMPONENT_NAME = 'barcodeScanner';
    const META_XML_PATH = join('force-app', 'main', 'default', 'lwc', COMPONENT_NAME, `${COMPONENT_NAME}.js-meta.xml`);

    const removeAiTag = (filePath: string): void => {
      const original = readFileSync(filePath, 'utf-8');
      const stripped = original.replace(/<ai>[\s\S]*?<\/ai>\s*/g, '');
      writeFileSync(filePath, stripped, 'utf-8');
    };

    it('should re-enrich and restore the <ai> tag after it has been stripped from the .js-meta.xml', () => {
      const metaXmlFilePath = join(testkit.projectDir, META_XML_PATH);

      removeAiTag(metaXmlFilePath);
      const xmlBeforeEnrich = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlBeforeEnrich).to.not.include('<ai>');

      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include(COMPONENT_NAME);
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );

      const xmlAfterEnrich = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlAfterEnrich).to.include('<ai>');
      expect(xmlAfterEnrich).to.include('</ai>');
      expect(xmlAfterEnrich, 'expected <description> inside <ai> tag').to.match(
        /<ai>[\s\S]*<description>[\s\S]*<\/description>[\s\S]*<\/ai>/
      );
      expect(xmlAfterEnrich, 'expected <descriptionScore> inside <ai> tag').to.match(
        /<ai>[\s\S]*<descriptionScore>[\s\S]*<\/descriptionScore>[\s\S]*<\/ai>/
      );
    });

    it('should re-enrich and restore the <ai> tag after it has been stripped, and return correct JSON output', () => {
      const metaXmlFilePath = join(testkit.projectDir, META_XML_PATH);

      removeAiTag(metaXmlFilePath);
      const xmlBeforeEnrich = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlBeforeEnrich).to.not.include('<ai>');

      const result = execCmd<EnrichmentMetrics>(
        `metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT} --json`,
        { cwd: testkit.projectDir, ensureExitCode: 0 }
      );
      expect(result.jsonOutput!.status).to.equal(0);
      const { total, success, skipped, fail } = result.jsonOutput!.result;
      expect(total).to.equal(1);
      expect(success.count).to.equal(1);
      expect(skipped.count).to.equal(0);
      expect(fail.count).to.equal(0);
      const [component] = success.components;
      expect(component.typeName).to.equal('LightningComponentBundle');
      expect(component.componentName).to.equal(COMPONENT_NAME);
      expect(component.requestId, 'expected requestId to be a req- prefixed string (e.g. req-0514-Ujt7QQs1)').to.match(
        /^req-/
      );

      const xmlAfterEnrich = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlAfterEnrich).to.include('<ai>');
      expect(xmlAfterEnrich).to.include('</ai>');
      expect(xmlAfterEnrich, 'expected <description> inside <ai> tag').to.match(
        /<ai>[\s\S]*<description>[\s\S]*<\/description>[\s\S]*<\/ai>/
      );
      expect(xmlAfterEnrich, 'expected <descriptionScore> inside <ai> tag').to.match(
        /<ai>[\s\S]*<descriptionScore>[\s\S]*<\/descriptionScore>[\s\S]*<\/ai>/
      );
    });
  });

  describe('unsupported metadata type enrichment', () => {
    it('should skip and report a component not found message for an unsupported metadata type', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ApexClass:testApexClass`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('ApexClass');
      expect(stdout).to.include('testApexClass');
      expect(stdout).to.include('Skipped');
      expect(stdout).to.include('Component not found in project.');
    });
  });

  describe('invalid project workspace', () => {
    it('should throw InvalidProjectWorkspaceError when run outside a Salesforce DX project directory', () => {
      const parentDir = join(testkit.projectDir, '..');
      const result = execCmd(
        `metadata enrich --target-org ${testkit.username} --metadata LightningComponentBundle:ankerplug`,
        {
          cwd: parentDir,
          ensureExitCode: 1,
        }
      );
      expect(result.shellOutput.stderr).to.include('InvalidProjectWorkspaceError');
    });
  });

  describe('missing metadata flag value', () => {
    it('should error when --metadata flag is provided without a value', () => {
      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata`, {
        cwd: testkit.projectDir,
        ensureExitCode: 1,
      });
      expect(result.shellOutput.stderr).to.include('Flag --metadata expects a value');
    });
  });

  describe('component not found in project', () => {
    it('should skip and report component not found for a non-existent LWC component', () => {
      const result = execCmd(
        `metadata enrich --target-org ${testkit.username} --metadata LightningComponentBundle:doesNotExist`,
        {
          cwd: testkit.projectDir,
          ensureExitCode: 0,
        }
      );
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('doesNotExist');
      expect(stdout).to.include('Skipped');
      expect(stdout).to.include('Component not found in project.');
    });
  });

  describe('enrichment with existing <skipUplift>false</skipUplift> in <ai> tag', () => {
    const COMPONENT = 'LightningComponentBundle:barcodeScanner';
    const COMPONENT_NAME = 'barcodeScanner';
    const META_XML_PATH = join('force-app', 'main', 'default', 'lwc', COMPONENT_NAME, `${COMPONENT_NAME}.js-meta.xml`);

    it('should enrich and preserve <skipUplift>false</skipUplift> inside the <ai> tag', () => {
      const metaXmlFilePath = join(testkit.projectDir, META_XML_PATH);

      // Ensure <ai> block exists with <skipUplift>false</skipUplift> before enrichment
      const original = readFileSync(metaXmlFilePath, 'utf-8');
      const stripped = original.replace(/<ai>[\s\S]*?<\/ai>\s*/g, '');
      const withSkipUplift = stripped.replace(
        '</LightningComponentBundle>',
        '    <ai>\n        <skipUplift>false</skipUplift>\n    </ai>\n</LightningComponentBundle>'
      );
      writeFileSync(metaXmlFilePath, withSkipUplift, 'utf-8');

      const xmlBefore = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlBefore).to.include('<skipUplift>false</skipUplift>');

      const result = execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });
      const { stdout } = result.shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include(COMPONENT_NAME);
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID (e.g. req-0514-Ujt7QQs1) in the results table').to.match(
        /req-\w+/
      );

      const xmlAfter = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlAfter, 'expected <description> inside <ai> tag').to.match(
        /<ai>[\s\S]*<description>[\s\S]*<\/description>[\s\S]*<\/ai>/
      );
      expect(xmlAfter, 'expected <descriptionScore> inside <ai> tag').to.match(
        /<ai>[\s\S]*<descriptionScore>[\s\S]*<\/descriptionScore>[\s\S]*<\/ai>/
      );
      expect(xmlAfter).to.include('<skipUplift>false</skipUplift>');
    });
  });

  describe('enrichment skipped when <skipUplift>true</skipUplift> is set in <ai> tag', () => {
    const COMPONENT = 'LightningComponentBundle:barcodeScanner';
    const COMPONENT_NAME = 'barcodeScanner';
    const META_XML_PATH = join('force-app', 'main', 'default', 'lwc', COMPONENT_NAME, `${COMPONENT_NAME}.js-meta.xml`);

    it('should not update the .js-meta.xml file when <skipUplift>true</skipUplift> is present in the <ai> tag', () => {
      const metaXmlFilePath = join(testkit.projectDir, META_XML_PATH);

      // Ensure <ai> block exists with <skipUplift>true</skipUplift> before enrichment
      const original = readFileSync(metaXmlFilePath, 'utf-8');
      const stripped = original.replace(/<ai>[\s\S]*?<\/ai>\s*/g, '');
      const withSkipUplift = stripped.replace(
        '</LightningComponentBundle>',
        '    <ai>\n        <skipUplift>true</skipUplift>\n    </ai>\n</LightningComponentBundle>'
      );
      writeFileSync(metaXmlFilePath, withSkipUplift, 'utf-8');

      const xmlBefore = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlBefore).to.include('<skipUplift>true</skipUplift>');

      execCmd(`metadata enrich --target-org ${testkit.username} --metadata ${COMPONENT}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });

      const xmlAfter = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlAfter).to.equal(xmlBefore);
    });
  });
});
