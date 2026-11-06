# ml-platform-lab

ML platform operations: Kubernetes, containers, GPU scheduling, a small operator.

Status: Learn DONE and Build DONE 2026-11-05 (early, Sprint 4 pull). Deep not started. Both levels are simulations, labelled as such: no real cluster was contacted at either level.
Project: P20. Fleet node: BlackBoxV2, BlackBoxV3, Dell R610 (cluster). Wave: Wave 6.

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

## Novelty

PROPOSED. See NOVELTY.md. The novelty text is a draft until the Jev claim_check gate passes on it.

## License

Code: Apache-2.0 (see LICENSE). Tutorials: CC BY 4.0. Ruled in D-V3-11, 2026-11-04.
