# ml-platform-lab

ML platform operations: Kubernetes, containers, GPU scheduling, a small operator.

Status: Learn DONE, Build DONE, and Deep DONE 2026-11-05 (early, Sprint 4 pull). v1.0 shipped. All three levels are simulations, labelled as such: no real cluster was contacted at any level. The rest of the v2 Deep scope is the v1.1 backlog in ROADMAP.md.
Project: P20. Fleet node: BlackBoxV2, BlackBoxV3, Dell R610 (cluster). Wave: Wave 6.

Live dashboard: https://jesunahmadushno.github.io/ml-platform-lab/

The dashboard (source in site/) runs JavaScript ports of the three simulators in the browser: a scheduler playground, a GPU and quota admission lab, a ModelEndpoint reconcile stepper, the simulated upgrade, and the modelled cost calculator. `npm run build` first runs site/src/sim.check.mjs, which replays run_learn.py, run_build.py and run_deep.py through the ports and deep-compares the output with the committed results files, so the page cannot drift from the Python. It is a simulation, labelled as such on every panel.

## Tests

The test files are plain scripts, as CI runs them:

    python3 tests/test_smoke.py
    python3 tests/test_learn_platform.py
    python3 tests/test_build_platform.py
    python3 tests/test_deep_platform.py
    python3 tests/test_invariants.py      # seeded randomized invariant checks, all three levels
    python3 tests/test_check_counts.py    # printed checks equal check( call sites (the dashboard's count)

`python3 -m pytest` also works: tests/conftest.py stops level-2-build/platform.py from colliding with the standard library platform module during collection. Research rigor review: docs/research-review.md.

## Start here

1. Read SPEC.md for scope and acceptance criteria.
2. Read DOSSIER.md for the past, present, and future of this problem (v1).
3. Read NOVELTY.md for the proposed novelty (DRAFT, pending the Jev claim_check gate).
4. Start at level-1-learn/README.md, then level-2-build, then level-3-deep.

## Level map

- Level 1, Learn: the core idea, built small and clean, with a teaching path.
- Level 2, Build: a real working system other people can run.
- Level 3, Deep: benchmarks, optimization, evaluation, hard cases.

## Benchmarks

| Test | Result |
| --- | --- |
| Learn simulated cluster scenario (stdlib, Muse VM, simulated and teaching only) | 10 pods created, 7 Running, 1 Pending, 2 Deleted; final endpoints 3; total running requests 4750m cpu and 4864 MiB; ConfigMap rollout leaves 2 api pods stale at MAX_BATCH 8 and 1 fresh at 16. Full record: level-1-learn/results_learn.json and level-1-learn/README.md. |
| Build simulated platform scenario (stdlib, Muse VM, simulated only, no real cluster) | 11 pods admitted, 2 quota rejections; 3 jobs finish 2 Succeeded and 1 Failed over 5 attempts, 2 retries, 9 ticks; GPU pods placed on both GPU nodes; plain and KServe-style services at 2 endpoints each routing 10 requests at 5 per endpoint; final Running 4 pods at 5000m cpu and 10240 MiB. Full record: level-2-build/results_build.json and level-2-build/README.md. |
| Deep simulated operator scenario (stdlib, Muse VM, simulated only, no real cluster, operator, or upgrade) | Controller keeps one ModelEndpoint (chat-endpoint, tiny-gpt, 3 replicas) at its declared version over 4 reconcile passes with 9 actions (4 creates, 4 replaces, 1 delete); version upgrade v1 to v2 in 1 log entry; drift healing recreates a deleted pod, replaces a tampered pod, deletes an extra pod; final 3 pods all at v2 at 1500m cpu and 3072 MiB; simulated cluster upgrade 1.29 to 1.30 in 11 steps, 4 pre-checks and 4 post-checks pass, no rollback; modelled illustrative cost 130 USD per month. Full record: level-3-deep/results_deep.json and level-3-deep/README.md. |

## Novelty

PROPOSED. See NOVELTY.md. The novelty text is a draft until the Jev claim_check gate passes on it.

## License

Code: Apache-2.0 (see LICENSE). Tutorials: CC BY 4.0. Ruled in D-V3-11, 2026-11-04.
