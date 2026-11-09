# ml-platform-lab

**Question.** Can a small home fleet run an ML platform on Kubernetes
(jobs with GPU scheduling, namespace quotas, a model endpoint kept at
its declared version by a small operator, and a version upgrade) with
every failure mode written down and each recovery shown?

**Headline.** No result yet: nothing has run on a real Kubernetes
cluster. A standard-library simulation of the platform replays its
three designed scenarios byte for byte; in the Deep scenario a
simulated operator heals a deleted, a tampered and an extra pod and
ends with 3 of 3 pods at the declared version after 9 actions over 4
reconcile passes (a designed scenario, so no interval).

**Field.** Systems and infrastructure, reliability. **Job family.**
Infrastructure and platform engineering (ML platform).

**Verdict.** Draft, not pre-registered. The simulators, 96
hand-computed checks and randomized invariant tests pass in CI on
Python 3.11 and 3.12, and one command regenerates every results file,
but the system under study, a Kubernetes platform, has never run, so
Functional is not met; no plan with hypotheses was locked before the
results, so Proposed is not met either.

Live dashboard: https://jesunahmadushno.github.io/ml-platform-lab/

## Reproduce

```text
python3 -m pytest tests/ -q
python3 level-1-learn/run_learn.py
python3 level-2-build/run_build.py
python3 level-3-deep/run_deep.py
git diff --exit-code level-*/results_*.json
```

Python 3 standard library only (pytest is optional: every test file
also runs as a plain script, as CI runs them). The runners rewrite the
three results files byte for byte; CI fails if any differs. The
dashboard: `cd site && npm ci && npm run build` (the build first
replays all three scenarios through the JavaScript ports and compares
them with the results files).

## Lifecycle

- Question: DONE 2026-11-04
- Proposal: OPEN
- Baseline: OPEN
- Build: IN PROGRESS 2026-11-05
- Evaluate: OPEN
- Report: IN PROGRESS 2026-11-08
- Review: OPEN
- Release: OPEN

The scaffold spec (2026-11-04) came before any code but has no
hypotheses or pass lines, so it is not a locked proposal. Build is in
progress because the simulators are built and tested but no real
cluster exists yet; the baseline (the state of a real cluster) has not
been measured. The tags v0.1, v0.5 and v1.0 (2026-11-05) mark the old
Learn, Build and Deep levels; they predate this standard and are not a
"v1.0 Released" verdict.

## Layout

| Path | What it holds |
| --- | --- |
| PROPOSAL.md | Question, draft hypotheses for a real-cluster drill, scaffold scope, prior work, dossier (not locked) |
| REPORT.md | Background, method, results that ran, misses, threats, research review, v1.1 backlog |
| level-1-learn/ | Code: cluster.py, run_learn.py; evidence: results_learn.json; write-up README.md |
| level-2-build/ | Code: platform.py, run_build.py; spec BUILD-SPEC.md; evidence: results_build.json; write-up README.md |
| level-3-deep/ | Code: deep_operator.py, run_deep.py; spec and hand-computed oracle DEEP-SPEC.md; evidence: results_deep.json; write-up README.md |
| tests/ | Hand-computed level tests, randomized invariants, check-count test, layout and no-grade test |
| docs/decisions/ | Records of hard-to-reverse choices |
| docs/index.md | Static summary page (legacy Pages source) |
| fanout/, PUBLICITY.md | Dated write-ups for readers (drafts) and the channel log |
| site/ | The live dashboard, built from the results files and docs |
| CHANGELOG.md, CITATION.cff, SECURITY.md, LICENSE | Release notes, citation, security policy, licence |

There is no separate src/, experiments/ or results/ folder: each level
folder holds its code next to the results file that code wrote, and
the site, the tests and CI read those files by path
(docs/decisions/0001).

## License

Code: Apache-2.0 (see LICENSE). Tutorials: CC BY 4.0. Ruled in D-V3-11, 2026-11-04.
