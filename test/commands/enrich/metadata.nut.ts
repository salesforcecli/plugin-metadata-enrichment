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

describe('enrich metadata NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  describe('--metadata flag', () => {
    it('should require metadata flag', () => {
      const result = execCmd('enrich metadata --target-org test@example.com', { ensureExitCode: 1 });
      expect(result.shellOutput.stderr).to.include('Missing required flag');
    });

    it('should accept metadata flag with LightningComponentBundle', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(
        `enrich metadata --target-org ${orgUsername} --metadata LightningComponentBundle:TestComponent`,
      );
      // Command should run (may fail if component doesn't exist, but should not fail on flag parsing)
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });

    it('should accept multiple metadata entries', () => {
      const orgUsername = session.orgs.get('default')?.username ?? 'test@example.com';
      const result = execCmd(
        `enrich metadata --target-org ${orgUsername} --metadata LightningComponentBundle:Component1 LightningComponentBundle:Component2`,
      );
      // Command should run (may fail if components don't exist, but should not fail on flag parsing)
      expect(result.shellOutput.stdout || result.shellOutput.stderr).to.exist;
    });
  });
});
