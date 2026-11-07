// Known-answer self-check, run by `npm run build` before vite.
// Replays run_learn.py, run_build.py and run_deep.py through the JS ports in sim.js and
// deep-compares every computed field with the committed level-*/results_*.json files.
// Only the runners' descriptive metadata (project, level, simulated, note) is excluded.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { replayLearn, buildScenario, replayDeep, applyDeep, DEEP_SCRIPT, countActs, costModel, deep, drillNodes, fuzz } from './sim.js';
import { checkCounts } from './checkCount.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const strip = ({ project, level, simulated, note, ...rest }) => rest; // eslint-disable-line no-unused-vars

const learnJson = read('level-1-learn/results_learn.json');
const buildJson = read('level-2-build/results_build.json');
const deepJson = read('level-3-deep/results_deep.json');
for (const j of [learnJson, buildJson, deepJson]) assert.equal(j.simulated, true);

assert.deepStrictEqual(replayLearn().results, strip(learnJson), 'Learn replay differs from results_learn.json');
assert.deepStrictEqual(buildScenario('final').results, strip(buildJson), 'Build replay differs from results_build.json');
assert.deepStrictEqual(replayDeep(), strip(deepJson), 'Deep replay differs from results_deep.json');

// The stepper's op replay must reach the same log as run_deep.py.
const { ctl, passes } = applyDeep(DEEP_SCRIPT);
assert.deepStrictEqual(ctl.action_log, deepJson.action_log);
assert.deepStrictEqual(passes.map(countActs), Object.values(deepJson.action_counts_by_pass));
assert.equal(ctl.healthy(), deepJson.endpoint_healthy_final);

// The isolated Failed branch from tests/test_deep_platform.py.
const bad = new deep.ClusterUpgrade('1.29', drillNodes(), '1.30', false).run_upgrade();
assert.equal(bad.status, 'Failed');
assert.deepStrictEqual(bad.pre_checks[3], { name: 'endpoint healthy before upgrade', pass: false });

// Cost calculator defaults equal the recorded assumptions and total.
const a = deepJson.cost_model.assumptions;
assert.deepStrictEqual(costModel(a.nodes, a.modelled_usd_per_node_per_month, a.modelled_storage_usd_per_month), deepJson.cost_model);

// The check count on the page is derived from tests/, never typed; it must be positive per level.
const counts = checkCounts();
for (const [k, v] of Object.entries(counts)) assert.ok(v > 0, `no check( calls found for ${k}`);

// The invariant fuzzer must find no violation at its default settings.
const inv = fuzz();
for (const i of inv) { assert.ok(i.checks > 0, `${i.label}: no checks ran`); assert.equal(i.violations, 0, i.label); }

console.log('sim ok', { learn: learnJson.summary.pods_created_total, build: buildJson.summary.pods_admitted, deep: deepJson.summary.total_actions, checks: counts, fuzzChecks: inv.map((i) => i.checks) });
