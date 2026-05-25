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
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { SourceTestkit } from '@salesforce/source-testkit';

const REPO = 'https://github.com/trailheadapps/dreamhouse-lwc.git';
const SAMPLE_LWC = 'LightningComponentBundle:barcodeScanner'; // LWC from dreamhouse-lwc

// These NUTs always run against a pre-configured MI-eligible (preset) org — same path locally and in CI.
//
// We use JWT bearer auth so CI doesn't depend on a refresh-token-backed auth URL that can rotate or
// be revoked when the local CLI session changes. testkit-canonical names are piggybacked because the
// upstream reusable workflow (salesforcecli/github-workflows/.github/workflows/nut.yml@main) only
// forwards a fixed set of secret names into the test process.
//
// Required env vars (all four):
//  TESTKIT_HUB_USERNAME   — username of the MI-eligible preset org
//  TESTKIT_JWT_KEY        — RSA private key (PEM contents, multi-line)
//  TESTKIT_JWT_CLIENT_ID  — Connected App Consumer Key
//  TESTKIT_HUB_INSTANCE   — org's My Domain URL
const TARGET_ORG = process.env.TESTKIT_HUB_USERNAME;
const JWT_KEY = process.env.TESTKIT_JWT_KEY;
const JWT_CLIENT_ID = process.env.TESTKIT_JWT_CLIENT_ID;
const INSTANCE_URL = process.env.TESTKIT_HUB_INSTANCE;

if (!TARGET_ORG || !JWT_KEY || !JWT_CLIENT_ID || !INSTANCE_URL) {
  throw new Error(
    'JWT auth requires TESTKIT_HUB_USERNAME, TESTKIT_JWT_KEY, TESTKIT_JWT_CLIENT_ID, and TESTKIT_HUB_INSTANCE.\n' +
      '  Local: source the values from your shell or a local secrets file.\n' +
      '  CI:    set all four as repo secrets (forwarded by salesforcecli/github-workflows/.github/workflows/nut.yml@main).'
  );
}

describe('metadata enrich NUTs', () => {
  let testkit: SourceTestkit;

  before(async () => {
    // testkit reads TESTKIT_JWT_KEY/CLIENT_ID/HUB_USERNAME/HUB_INSTANCE and runs the JWT login
    // for us, registering the org as default-dev-hub. We then override default-target-org so
    // tests that omit --target-org find the same org.
    testkit = await SourceTestkit.create({
      nut: fileURLToPath(import.meta.url),
      repository: REPO,
      orgless: true,
    });

    execSync(`sf config set target-org=${TARGET_ORG}`, {
      cwd: testkit.projectDir,
      stdio: 'inherit',
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
    it('should render the full help: summary, USAGE, required flags, GLOBAL FLAGS, EXAMPLES', () => {
      const { stdout } = runEnrich('--help', { ensureExitCode: 0 }).shellOutput;
      expect(stdout).to.include('Enrich metadata components in your DX project by adding AI-generated descriptions.');
      expect(stdout).to.include('USAGE');
      expect(stdout).to.match(/\$ sf metadata enrich/);
      expect(stdout).to.include('FLAGS');
      expect(stdout, 'expected required --metadata flag in help').to.match(
        /-m, --metadata=<value>\.\.\.\s+\(required\)/
      );
      expect(stdout, 'expected --target-org flag in help').to.match(/-o, --target-org=<value>/);
      expect(stdout).to.include('GLOBAL FLAGS');
      expect(stdout).to.match(/--json\s+Format output as json\./);
      expect(stdout).to.include('EXAMPLES');
    });
  });

  describe('required flags', () => {
    it('should exit 2 with "Missing required flag metadata" when --metadata is omitted', () => {
      const { stderr } = runEnrich(`--target-org ${TARGET_ORG}`, { ensureExitCode: 2 }).shellOutput;
      expect(stderr).to.include('Missing required flag metadata');
      expect(stderr).to.include('See more help with --help');
    });

    it('should fall back to default target-org and successfully enrich the component', () => {
      const { stdout } = runEnrich(`--metadata ${SAMPLE_LWC}`, { ensureExitCode: 0 }).shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('barcodeScanner');
      expect(stdout).to.include('Success');
      expect(stdout, 'expected a req- prefixed request ID').to.match(/req-\w+/);
    });
  });

  describe('--metadata flag', () => {
    it('should enrich a single LightningComponentBundle component', () => {
      const { stdout } = runEnrich(`--target-org ${TARGET_ORG} --metadata ${SAMPLE_LWC}`, {
        ensureExitCode: 0,
      }).shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('barcodeScanner');
      expect(stdout).to.include('Success');
      expect(stdout).to.match(/req-\w+/);
    });

    it('should enrich both components when --metadata is given two variadic values', () => {
      const { stdout } = runEnrich(
        `--target-org ${TARGET_ORG} --metadata ${SAMPLE_LWC} LightningComponentBundle:propertySummary`,
        { ensureExitCode: 0 }
      ).shellOutput;
      expect(stdout).to.include('Total Components Processed: 2');
      for (const name of ['barcodeScanner', 'propertySummary']) {
        expect(stdout).to.include(name);
      }
      const successRows = stdout.match(/Success/g) ?? [];
      expect(successRows.length, 'expected two Success rows').to.be.at.least(2);
    });

    it('should enrich the component when -m short flag is used', () => {
      const { stdout } = runEnrich(`--target-org ${TARGET_ORG} -m ${SAMPLE_LWC}`, {
        ensureExitCode: 0,
      }).shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('barcodeScanner');
      expect(stdout).to.include('Success');
    });
  });

  describe('error scenarios', () => {
    it('should exit 1 with NamedOrgNotFoundError when --target-org is unauthenticated', () => {
      const { stderr } = runEnrich(`--target-org NoSuchOrg@example.com --metadata ${SAMPLE_LWC}`, {
        ensureExitCode: 1,
      }).shellOutput;
      expect(stderr).to.include('NamedOrgNotFoundError');
      expect(stderr).to.include('No authorization information found for NoSuchOrg@example.com');
    });
  });

  describe('--json', () => {
    type EnrichJson = {
      status: number;
      result: {
        success: { count: number; components: Array<{ typeName: string; componentName: string; requestId: string }> };
        fail: { count: number; components: unknown[] };
        skipped: { count: number; components: unknown[] };
        total: number;
      };
    };

    // The plugin currently prints the human-readable table to stdout in addition to the JSON envelope,
    // so testkit's parseJson rejects the combined output. We pull the trailing JSON object out of stdout.
    const extractJsonEnvelope = (stdout: string): EnrichJson => {
      const match = stdout.match(/\{[\s\S]*\}\s*$/);
      expect(match, 'expected stdout to contain a trailing JSON envelope').to.not.be.null;
      return JSON.parse(match![0]) as EnrichJson;
    };

    it('should emit a status:0 JSON envelope with success-only metrics for a successful enrich', () => {
      const { stdout } = runEnrich(`--target-org ${TARGET_ORG} --metadata ${SAMPLE_LWC} --json`, {
        ensureExitCode: 0,
      }).shellOutput;
      const json = extractJsonEnvelope(stdout);
      expect(json.status).to.equal(0);
      expect(json.result.total).to.equal(1);
      expect(json.result.success.count).to.equal(1);
      expect(json.result.fail.count).to.equal(0);
      expect(json.result.skipped.count).to.equal(0);
      expect(json.result.success.components).to.have.lengthOf(1);
      const [component] = json.result.success.components;
      expect(component).to.include({
        typeName: 'LightningComponentBundle',
        componentName: 'barcodeScanner',
      });
      expect(component.requestId, 'expected a req- prefixed request ID in success component').to.match(/^req-\w+/);
    });
  });

  describe('single-component enrichment', () => {
    const SINGLE_LWC = 'LightningComponentBundle:barcodeScanner';
    const SINGLE_LWC_NAME = 'barcodeScanner';

    it('should successfully enrich a single component', () => {
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${SINGLE_LWC}`, {
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
  });

  describe('wildcard component enrichment', () => {
    const WILDCARD_METADATA = '"LightningComponentBundle:propertyTile*"';
    const EXPECTED_COMPONENTS = ['propertyTile', 'propertyTileList'];

    it('should successfully enrich all wildcard-matched components and report correct human output', () => {
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${WILDCARD_METADATA}`, {
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
  });

  describe('multiple explicit components enrichment', () => {
    const COMPONENTS = ['barcodeScanner', 'daysOnMarket', 'paginator'];
    const METADATA_FLAGS = COMPONENTS.map((c) => `--metadata LightningComponentBundle:${c}`).join(' ');

    it('should successfully enrich multiple explicit components and report correct human output', () => {
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} ${METADATA_FLAGS}`, {
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
  });

  describe('file update verification', () => {
    const COMPONENT = 'LightningComponentBundle:barcodeScanner';
    const COMPONENT_NAME = 'barcodeScanner';
    const META_XML_PATH = join('force-app', 'main', 'default', 'lwc', COMPONENT_NAME, `${COMPONENT_NAME}.js-meta.xml`);

    it('should report correct human output and update the .js-meta.xml with an <ai> tag', () => {
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${COMPONENT}`, {
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
      expect(xmlContent, 'expected <score> inside <ai> tag').to.match(
        /<ai>[\s\S]*<score>[\s\S]*<\/score>[\s\S]*<\/ai>/
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

      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${COMPONENT}`, {
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
      expect(xmlAfterEnrich, 'expected <score> inside <ai> tag').to.match(
        /<ai>[\s\S]*<score>[\s\S]*<\/score>[\s\S]*<\/ai>/
      );
    });
  });

  describe('unsupported metadata type enrichment', () => {
    it('should skip and report a component not found message for an unsupported metadata type', () => {
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ApexClass:testApexClass`, {
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
        `metadata enrich --target-org ${TARGET_ORG} --metadata LightningComponentBundle:ankerplug`,
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
      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata`, {
        cwd: testkit.projectDir,
        ensureExitCode: 2,
      });
      expect(result.shellOutput.stderr).to.include('Flag --metadata expects a value');
    });
  });

  describe('component not found in project', () => {
    it('should skip and report component not found for a non-existent LWC component', () => {
      const result = execCmd(
        `metadata enrich --target-org ${TARGET_ORG} --metadata LightningComponentBundle:doesNotExist`,
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

      const result = execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${COMPONENT}`, {
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
      expect(xmlAfter, 'expected <score> inside <ai> tag').to.match(/<ai>[\s\S]*<score>[\s\S]*<\/score>[\s\S]*<\/ai>/);
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

      execCmd(`metadata enrich --target-org ${TARGET_ORG} --metadata ${COMPONENT}`, {
        cwd: testkit.projectDir,
        ensureExitCode: 0,
      });

      const xmlAfter = readFileSync(metaXmlFilePath, 'utf-8');
      expect(xmlAfter).to.equal(xmlBefore);
    });
  });

  // No org is authenticated or aliased to the project. Enrich must surface the missing-org
  // error rather than silently fail or hang on credential discovery. We simulate this by
  // unsetting the project-local target-org config; the testkit HOME has only target-dev-hub
  // set globally (from JWT login), so removing the project-local target-org leaves the CLI
  // with no default environment.
  describe('not authenticated or aliased to org', () => {
    before(() => {
      execSync('sf config unset target-org', { cwd: testkit.projectDir, stdio: 'inherit' });
    });

    after(() => {
      execSync(`sf config set target-org=${TARGET_ORG}`, { cwd: testkit.projectDir, stdio: 'inherit' });
    });

    it('should exit 1 with NoDefaultEnvError when no org is authed or aliased', () => {
      const { stdout, stderr } = runEnrich(`--metadata ${SAMPLE_LWC}`, { ensureExitCode: 1 }).shellOutput;
      expect(stderr).to.include('NoDefaultEnvError');
      expect(stderr).to.include('No default environment found');
      expect(stderr).to.match(/Use -o or --target-org to specify an environment/);
      expect(stdout).to.equal('');
    });
  });

  // Pilot perm disabled: a separate org without the MetadataAiEnrichmentPilot perm. The
  // service responds with an "isn't eligible" error which the plugin surfaces as a Failed
  // row in the results table (exit code 0, no throw).
  //
  // CI feasibility: this needs a SECOND JWT-authed org. The reusable nut workflow forwards
  // only a fixed set of secret names, so we either piggyback on extra TESTKIT_NON_PILOT_*
  // names via an inline workflow job, or run this locally. We gate on env-var presence so
  // it runs anywhere the secrets are configured and gracefully skips otherwise.
  describe('pilot org perm disabled', () => {
    const NON_PILOT_USERNAME = process.env.TESTKIT_NON_PILOT_HUB_USERNAME;
    const NON_PILOT_JWT_KEY = process.env.TESTKIT_NON_PILOT_JWT_KEY;
    const NON_PILOT_CLIENT_ID = process.env.TESTKIT_NON_PILOT_JWT_CLIENT_ID;
    const NON_PILOT_INSTANCE = process.env.TESTKIT_NON_PILOT_HUB_INSTANCE;
    const allSet = !!(NON_PILOT_USERNAME && NON_PILOT_JWT_KEY && NON_PILOT_CLIENT_ID && NON_PILOT_INSTANCE);

    before(function () {
      if (!allSet) {
        this.skip();
      }
      const keyPath = join(testkit.projectDir, 'non-pilot-jwt.key');
      writeFileSync(keyPath, NON_PILOT_JWT_KEY, 'utf-8');
      execSync(
        `sf org login jwt --username ${NON_PILOT_USERNAME} --client-id ${NON_PILOT_CLIENT_ID} --jwt-key-file ${keyPath} --instance-url ${NON_PILOT_INSTANCE}`,
        { cwd: testkit.projectDir, stdio: 'inherit' }
      );
    });

    it('should report Failed with an "isn\'t eligible" message in the results table', function () {
      if (!allSet) {
        this.skip();
      }
      const { stdout } = runEnrich(`--target-org ${NON_PILOT_USERNAME} --metadata ${SAMPLE_LWC}`, {
        ensureExitCode: 0,
      }).shellOutput;
      expect(stdout).to.include('Total Components Processed: 1');
      expect(stdout).to.include('LightningComponentBundle');
      expect(stdout).to.include('barcodeScanner');
      expect(stdout).to.include('Failed');
      // Match both straight ' (U+0027) and curly ’ (U+2019) apostrophes — server output uses curly.
      expect(stdout).to.match(/isn['’]t eligible for metadata enrichment/);
      expect(stdout).to.include('Your Salesforce admin can help with that');
    });
  });
});
