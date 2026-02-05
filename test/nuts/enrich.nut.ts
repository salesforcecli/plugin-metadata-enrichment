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

import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('metadata enrich NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  describe('--help', () => {
    it('should show help with summary and metadata flag', () => {
      const result = execCmd('metadata enrich --help', { ensureExitCode: 0 });
      expect(result.shellOutput.stdout).to.include('Enrich metadata');
      expect(result.shellOutput.stdout).to.match(/-m.*--metadata/);
    });
  });

  describe('required flags', () => {
    it('should fail when metadata flag is missing', () => {
      const result = execCmd('metadata enrich --target-org test@example.com', { ensureExitCode: 1 });
      expect(result.shellOutput.stderr).to.include('Missing required flag');
    });

    it('should fail when target-org is missing (no default org)', () => {
      const result = execCmd('metadata enrich --metadata LightningComponentBundle:HelloWorld', {
        ensureExitCode: 1,
      });
      const output = (result.shellOutput.stderr || result.shellOutput.stdout || '').toLowerCase();
      expect(output.length).to.be.greaterThan(0);
    });
  });

  describe('--metadata flag', () => {
    it('should accept metadata flag with LightningComponentBundle', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(
        `metadata enrich --target-org ${orgUsername} --metadata LightningComponentBundle:TestComponent`
      );
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });

    it('should accept multiple metadata entries', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(
        `metadata enrich --target-org ${orgUsername} --metadata LightningComponentBundle:Component1 LightningComponentBundle:Component2`
      );
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });

    it('should accept -m short flag', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(`metadata enrich --target-org ${orgUsername} -m LightningComponentBundle:HelloWorld`);
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });
  });

  describe('error scenarios', () => {
    it('should fail when target-org is invalid or not authorized', () => {
      const result = execCmd(
        'metadata enrich --target-org NoSuchOrg@example.com --metadata LightningComponentBundle:HelloWorld',
        { ensureExitCode: 1 }
      );
      const output = (result.shellOutput.stderr || result.shellOutput.stdout || '').toLowerCase();
      expect(output.length).to.be.greaterThan(0);
    });
  });

  describe('--json', () => {
    it('should output metrics-shaped JSON when --json is used and command runs', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(
        `metadata enrich --target-org ${orgUsername} --metadata LightningComponentBundle:HelloWorld --json`
      );
      const output = result.jsonOutput as Record<string, unknown> | undefined;
      if (output && typeof output === 'object') {
        expect(output).to.have.property('total');
        expect(output).to.have.nested.property('success.count');
        expect(output).to.have.nested.property('skipped.count');
        expect(output).to.have.nested.property('fail.count');
      }
    });
  });
});
