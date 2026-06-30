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

// The `sf metadata enrich` command and its hosting package have been retired in
// favor of the sanctioned portable Skill. This plugin intentionally ships no
// commands; this smoke test keeps the test pipeline coherent in the meantime.
describe('plugin-metadata-enrichment', () => {
  it('ships no commands', () => {
    expect(true).to.equal(true);
  });
});
