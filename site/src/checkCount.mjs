// Counts check( call sites in the level test scripts. Used at build time by
// vite.config.js and sim.check.mjs; tests/test_check_counts.py proves this
// equals the number of checks each script prints as passing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests');
export const SCRIPTS = { Learn: 'test_learn_platform.py', Build: 'test_build_platform.py', Deep: 'test_deep_platform.py' };
export function checkCounts() {
  const out = {};
  for (const [level, file] of Object.entries(SCRIPTS)) out[level] = (fs.readFileSync(path.join(TESTS, file), 'utf8').match(/^\s*check\(/gm) || []).length;
  return out;
}
