# REPORT: ml-platform-lab (P20)

Status: interim report, 2026-11-08. The question is not answered yet:
nothing in this repo has run on a real Kubernetes cluster. What exists
is a deterministic, standard-library simulation of the platform, with
one designed scenario per level and hand-computed tests. This report
records what ran, where its evidence is, and what is missing. Sections
after "Evidence map" are moved verbatim from the files they replace
(the old README body, docs/research-review.md and ROADMAP.md; rubric
scores removed, grades are internal) and keep the old file names as
written.

## Background

The question (PROPOSAL.md) asks whether a small home fleet can run an
ML platform on Kubernetes, with every failure mode written down and
each recovery shown. The scaffold spec asked for a local kind or k3d
cluster at Learn. The work ran in three levels on 2026-11-05 on the
Muse VM, where the toolchain check found no kubectl, kind, k3d or
docker; nothing was installed, so every level was built as a
simulation (docs/decisions/0002): core objects and a one-rule
scheduler (level-1-learn), jobs, GPU scheduling, namespace quotas and a
KServe-style endpoint (level-2-build), and a ModelEndpoint operator, a
cluster upgrade and a modelled cost page (level-3-deep). Each level
folder has its own write-up with method, tables and failure modes.

## Method

- Each level's runner (level-*/run_*.py) plays one designed scenario
  through the level's simulator and writes level-*/results_*.json with
  sorted keys and no wall-clock fields, so the files are byte-identical
  on every run. CI reruns all three runners on Python 3.11 and 3.12 and
  fails if any results file differs from the committed copy.
- Expected values were computed by hand from the documented rules
  (level-2-build/BUILD-SPEC.md, the oracle in level-3-deep/DEEP-SPEC.md)
  and asserted in tests/test_learn_platform.py (28 checks),
  tests/test_build_platform.py (39) and tests/test_deep_platform.py
  (29). tests/test_check_counts.py proves each script prints exactly as
  many passing checks as it has check( call sites.
- tests/test_invariants.py adds seeded randomized property checks
  (200 runs of 25 steps per level): no node over-commit, no quota
  overrun, nodeSelector and taint rules hold, reconcile converges from
  arbitrary drift and is idempotent.
- The dashboard (site/) runs JavaScript ports of the three simulators;
  its build first replays all three scenarios through the ports and
  deep-compares them with the committed results files.

## Hypotheses scored

No hypothesis was registered before the results, so none is scored as
confirmed or refuted. The levels are demonstrations whose outcomes
(for example which job fails, and how often) are declared in the
scenario. The draft hypotheses for the confirmatory cycle, all on a
real cluster, are in PROPOSAL.md.

## Results that did run

All values are simulated scenario outputs, not measurements of a
cluster. Each scenario is deterministic, so there is no interval.

| Result | Value | Evidence file | Regenerate or check |
| --- | --- | --- | --- |
| Learn: simulated core objects over 3 nodes | 10 pods created, 7 Running, 1 Pending, 2 Deleted; 3 final endpoints; 4750m cpu and 4864 MiB running; after the ConfigMap edit 2 api pods stale at MAX_BATCH 8, 1 fresh at 16 | level-1-learn/results_learn.json | python3 level-1-learn/run_learn.py (byte-identical) |
| Build: simulated platform | 11 pods admitted, 2 quota rejections; 3 jobs end 2 Succeeded, 1 Failed over 5 attempts, 2 retries, 9 ticks; 3 GPU pods on both GPU nodes; plain and KServe-style services at 2 endpoints each; 4 pods Running at 5000m cpu and 10240 MiB | level-2-build/results_build.json | python3 level-2-build/run_build.py (byte-identical) |
| Deep: simulated operator | one ModelEndpoint (3 replicas) over 4 reconcile passes, 9 actions (4 creates, 4 replaces, 1 delete), pass 2 idempotent; v1 to v2 in 1 log entry; deleted, tampered and extra pod healed; 3 of 3 pods at v2, 1500m cpu and 3072 MiB | level-3-deep/results_deep.json | python3 level-3-deep/run_deep.py (byte-identical) |
| Deep: simulated cluster upgrade | 1.29 to 1.30 in 11 steps, 4 of 4 pre-checks and 4 of 4 post-checks pass, no rollback | level-3-deep/results_deep.json | python3 level-3-deep/run_deep.py |
| Deep: modelled cost | 130 USD per month, from invented unit prices, illustrative only | level-3-deep/results_deep.json | python3 level-3-deep/run_deep.py |
| Hand-computed checks | 96 (28 Learn, 39 Build, 29 Deep), all pass | tests/ | python3 tests/test_check_counts.py |

## Misses

- No real cluster at any level: no kind or k3d cluster, no kubectl, no
  container, no GPU device plugin, no CRD applied to an API server, no
  real operator deployment and no real version upgrade. This is the
  central miss and the reason the verdict is Draft: the system under
  study has never run.
- Run on the Muse VM, not the assigned fleet nodes BlackBoxV2,
  BlackBoxV3 and the Dell R610; node capacities are teaching values.
- One small designed scenario per level (a 10-pod run at Learn, 11
  admitted pods at Build, a single endpoint with 3 replicas at Deep).
- The P19 training job and the P03 serving endpoint are simulated
  stand-ins. The KServe-style object models what an InferenceService
  declares; neither KServe nor Ray Serve ran. Autoscaling bounds are
  declared only; no autoscaler acts on them.
- The scheduler is one documented rule (lowest cpu utilisation, ties by
  name; memory and GPU are fit checks); taints model NoSchedule only;
  jobs run one at a time.
- Compressed Deep scope: replaces run in name order with no rolling
  update strategy or availability guard; the rest of the v2 Deep scope
  is the v1.1 backlog below.
- The cost page uses invented unit prices; no real cost data.
- Upgrade failure path: ClusterUpgrade.run_upgrade() keeps recording
  steps after a failed pre-check and reports Failed only at the end,
  with rollback_triggered left false. A real procedure would halt
  before step 2. Left unchanged pending an Owner decision (it changes
  deep_operator.py, its tests and results_deep.json).
- The paper angle in the scaffold spec (Kueue-style fairness at
  two-GPU scale) was not attempted.

## Threats to validity

See "Threats to validity" in the research review below (construct,
internal, external, conclusion) and each level write-up's failure
modes. In short: "scheduler", "quota" and "operator" mean this repo's
simplified rules; failures are declared, not observed; capacities are
not measured hardware.

## Conclusion

The repo is a careful, reproducible teaching model of an ML platform,
with every recorded number regenerated byte for byte in CI and an
in-browser twin proven equal to it. It does not yet answer its
question. The next step is a real kind or k3d cluster on the fleet
nodes (Owner call), a locked PROPOSAL.md with recovery targets, and a
timed drill on that cluster.

## Evidence map

| Old file | New home |
| --- | --- |
| SPEC.md, NOVELTY.md, DOSSIER.md | PROPOSAL.md |
| level-2-build/BUILD-SPEC.md, level-3-deep/DEEP-SPEC.md | unchanged, next to their code (docs/decisions/0001) |
| README.md body (status, tests, benchmarks, reading order, novelty) | REPORT.md, below |
| docs/research-review.md | REPORT.md, below |
| ROADMAP.md | REPORT.md, below (Future work) |
| Level grades and publicity rubric scores | removed; grades are internal |

## Results on record (moved from the README, 2026-11-07)

ML platform operations: Kubernetes, containers, GPU scheduling, a small operator.

Status: Learn DONE, Build DONE, and Deep DONE 2026-11-05 (early, Sprint 4 pull). v1.0 shipped. All three levels are simulations, labelled as such: no real cluster was contacted at any level. The rest of the v2 Deep scope is the v1.1 backlog in ROADMAP.md.
Project: P20. Fleet node: BlackBoxV2, BlackBoxV3, Dell R610 (cluster). Wave: Wave 6.

Live dashboard: https://jesunahmadushno.github.io/ml-platform-lab/

The dashboard (source in site/) runs JavaScript ports of the three simulators in the browser: a scheduler playground, a GPU and quota admission lab, a ModelEndpoint reconcile stepper, the simulated upgrade, and the modelled cost calculator. `npm run build` first runs site/src/sim.check.mjs, which replays run_learn.py, run_build.py and run_deep.py through the ports and deep-compares the output with the committed results files, so the page cannot drift from the Python. It is a simulation, labelled as such on every panel.

### Tests

The test files are plain scripts, as CI runs them:

    python3 tests/test_smoke.py
    python3 tests/test_learn_platform.py
    python3 tests/test_build_platform.py
    python3 tests/test_deep_platform.py
    python3 tests/test_invariants.py      # seeded randomized invariant checks, all three levels
    python3 tests/test_check_counts.py    # printed checks equal check( call sites (the dashboard's count)

`python3 -m pytest` also works: tests/conftest.py stops level-2-build/platform.py from colliding with the standard library platform module during collection. Research rigor review: docs/research-review.md.

### Start here

1. Read SPEC.md for scope and acceptance criteria.
2. Read DOSSIER.md for the past, present, and future of this problem (v1).
3. Read NOVELTY.md for the proposed novelty (DRAFT, pending the Jev claim_check gate).
4. Start at level-1-learn/README.md, then level-2-build, then level-3-deep.

### Level map

- Level 1, Learn: the core idea, built small and clean, with a teaching path.
- Level 2, Build: a real working system other people can run.
- Level 3, Deep: benchmarks, optimization, evaluation, hard cases.

### Benchmarks

| Test | Result |
| --- | --- |
| Learn simulated cluster scenario (stdlib, Muse VM, simulated and teaching only) | 10 pods created, 7 Running, 1 Pending, 2 Deleted; final endpoints 3; total running requests 4750m cpu and 4864 MiB; ConfigMap rollout leaves 2 api pods stale at MAX_BATCH 8 and 1 fresh at 16. Full record: level-1-learn/results_learn.json and level-1-learn/README.md. |
| Build simulated platform scenario (stdlib, Muse VM, simulated only, no real cluster) | 11 pods admitted, 2 quota rejections; 3 jobs finish 2 Succeeded and 1 Failed over 5 attempts, 2 retries, 9 ticks; GPU pods placed on both GPU nodes; plain and KServe-style services at 2 endpoints each routing 10 requests at 5 per endpoint; final Running 4 pods at 5000m cpu and 10240 MiB. Full record: level-2-build/results_build.json and level-2-build/README.md. |
| Deep simulated operator scenario (stdlib, Muse VM, simulated only, no real cluster, operator, or upgrade) | Controller keeps one ModelEndpoint (chat-endpoint, tiny-gpt, 3 replicas) at its declared version over 4 reconcile passes with 9 actions (4 creates, 4 replaces, 1 delete); version upgrade v1 to v2 in 1 log entry; drift healing recreates a deleted pod, replaces a tampered pod, deletes an extra pod; final 3 pods all at v2 at 1500m cpu and 3072 MiB; simulated cluster upgrade 1.29 to 1.30 in 11 steps, 4 pre-checks and 4 post-checks pass, no rollback; modelled illustrative cost 130 USD per month. Full record: level-3-deep/results_deep.json and level-3-deep/README.md. |

### Novelty

PROPOSED. See NOVELTY.md. The novelty text is a draft until the Jev claim_check gate passes on it.

### License

Code: Apache-2.0 (see LICENSE). Tutorials: CC BY 4.0. Ruled in D-V3-11, 2026-11-04.

## Research review (docs/research-review.md, 2026-11-07)

Reviewed 2026-11-07 against a PhD-level rubric for an engineering and
teaching simulation. The rubric scores are kept internal and are not
shown here; the evidence and status for each criterion are.

Bottom line: a careful, deterministic, honestly labelled teaching
simulation with hand-computed tests. Its weakest points are external
validity (nothing ran on a real cluster) and measurement (no figure
comes from a real system). The cheap gaps are now closed; the remaining
ones need a real cluster or a scope decision, each named below.

### Findings by criterion

| Criterion | Evidence | Status after this change |
| --- | --- | --- |
| Research question | SPEC.md states the scope (core objects, GPU scheduling, a tiny operator) and a paper angle: "what Kueue-style fairness does at two-GPU scale". The shipped work answers the teaching scope, not the paper question. | Open: needs a scope decision (see gap 4). |
| Hypotheses | No falsifiable hypothesis is stated; the levels are demonstrations with designed scenarios. | Open: tied to gap 4. |
| Method | Rules are written down (lowest cpu utilisation, ties by name; admit, validate, quota, schedule; reconcile create, replace, delete in name order) and implemented in stdlib Python. | Improved: the same rules now run in the browser, proven equal to the Python at build time. |
| Baselines and comparison | The only comparison is plain Service vs KServe-style InferenceService, by what each declares. No comparison with the real kube-scheduler, Kueue, or controller-runtime. | Open: gap 3. |
| Statistics and uncertainty | Every model is deterministic with declared outcomes, so there is no sampling variance to report. Uncertainty only arises once real measurements exist (gap 2). | Not applicable until measurement exists. |
| Reproducibility | Deterministic runners, byte-identical results files, CI reruns and diffs them on Python 3.11 and 3.12. | Fixed: `python3 -m pytest` failed at collection (level-2-build/platform.py shadows the stdlib platform module). tests/conftest.py fixes collection without renaming any file. |
| Validation | 96 hand-computed checks, but each level checks one designed scenario only. | Fixed: tests/test_invariants.py adds seeded randomized property checks (200 runs x 25 steps per level): no node over-commit, no quota overrun, nodeSelector and taint rules hold for every Running pod, reconcile converges from arbitrary drift and is idempotent. The dashboard runs the same properties live, labelled as a new check. |
| Threats to validity | Every results file and README labels the work as simulated; failure modes are written for Deep. | Improved: the dashboard and this file list the threats explicitly (below). |
| Related work | NOVELTY.md is a DRAFT with one prior-art row and "NO MEASUREMENT YET". | Improved: related work reviewed below with citations. NOVELTY.md itself stays a draft, as its own gate requires. |
| Limitations | Each level README has a "What this level does not do" section; ROADMAP.md names the v1.1 backlog. | Kept, and surfaced on the dashboard. |

### Gaps fixed in this change

1. Reproducibility bug: `python3 -m pytest` now collects and passes
   (tests/conftest.py). The script-style CI runs are unchanged.
2. Single-path validation: randomized invariant tests for all three
   levels (tests/test_invariants.py), added to CI.
3. Typed headline figure: the "96 checks" figure is now derived. The
   dashboard counts `check(` call sites in tests/ at build time, and
   tests/test_check_counts.py proves that count equals the number of
   checks each script prints as passing.
4. Look-alike risk for the interactive pages: site/src/sim.check.mjs
   replays all three runners through the JavaScript ports and
   deep-compares them with the committed results files on every build.
5. Labelling: grades are shown as self-assessed (since 2026-11-08
   grades are internal and no longer shown), NOVELTY as DRAFT and
   unverified, the cost model as modelled with invented prices, and
   every recorded table as recorded scenario output.
6. Related work: reviewed below.

### Gaps that remain, and what each one needs

1. External validity (largest). Every level is a simulation; the SPEC
   Learn scope asked for a local kind or k3d cluster. Needs: a kind or
   k3d cluster on the fleet nodes (BlackBoxV2, BlackBoxV3, Dell R610),
   the ModelEndpoint CRD applied as YAML to a real API server, and a
   controller-runtime (or kopf) controller replaying the Deep scenario.
   Roughly a day of setup; no paid service. ROADMAP items 1 and 2.
2. No measurement. Needs the real cluster from gap 1 plus
   instrumentation: scheduling latency and throughput from
   kube-scheduler metrics, reconcile timing from the controller, and
   repeated runs (at least 30 per configuration) so that intervals can
   be reported. Then statistics and uncertainty become applicable.
3. No baseline against real components. Needs the same cluster: replay
   the Learn and Build pod sequences through the real kube-scheduler
   (default NodeResourcesFit scoring weighs cpu and memory, not cpu
   only) and report placement agreement with the simulator.
4. Paper question not attempted (Kueue-style fairness at two-GPU
   scale). Needs a scope decision by the owner first, then Kueue
   installed on a cluster with the two physical GPUs, a workload trace
   (synthetic, declared in advance), and a fairness metric such as
   dominant-share spread. A simulated fairness model alone could be
   built without hardware, but it changes the study's scope and the
   recorded results, so it is not done as a "cheap fix".
5. Model simplifications (cpu-only scoring, NoSchedule-only taints,
   sequential jobs, replace in name order without an availability
   guard). Each is a deliberate teaching choice recorded in the
   READMEs; changing one changes the recorded scenario and its
   hand-computed tests. ROADMAP item 3 covers the availability guard.
   Needs: an owner decision per model change, then re-derived
   hand-computed expectations.
6. Cost model uses invented unit prices. Needs real data: measured
   fleet power draw and capacity, or a dated cloud bill extract
   (ROADMAP item 6).
7. Upgrade failure path. As written, ClusterUpgrade.run_upgrade() keeps
   recording steps after a failed pre-check and only reports Failed at
   the end, with rollback_triggered left false. Fixing the control flow
   changes deep_operator.py and its tests, so it is flagged here and on
   the dashboard rather than changed silently. Needs: an owner decision;
   no compute.

### Threats to validity

- Construct: "scheduler", "quota" and "operator" here mean the repo's
  simplified rules, not Kubernetes behaviour in general.
- Internal: outcomes such as job failures are declared in the scenario
  (fail_attempts), so the job timeline demonstrates retry logic rather
  than observing failures.
- External: node names stand for real fleet machines, but capacities
  are teaching values, not measured hardware.
- Conclusion: with one designed scenario per level, the recorded
  numbers show the rules work as written; the new invariant tests
  widen that to random sequences but still test the model, not a
  cluster.

### Related work

- Verma et al., "Large-scale cluster management at Google with Borg",
  EuroSys 2015. The production lineage of the pod, priority and quota
  ideas modelled here.
- Schwarzkopf et al., "Omega: flexible, scalable schedulers for large
  compute clusters", EuroSys 2013. Shared-state scheduling, the design
  space the single-loop scheduler here sits at the simplest end of.
- Burns, Grant, Oppenheimer, Brewer and Wilkes, "Borg, Omega, and
  Kubernetes", ACM Queue 14(1), 2016. The reconcile-loop (controller)
  pattern that level 3 simulates.
- Hindman et al., "Mesos: A Platform for Fine-Grained Resource Sharing
  in the Data Center", NSDI 2011. Two-level resource sharing, an
  alternative to namespace quotas for multi-tenancy.
- Ghodsi et al., "Dominant Resource Fairness: Fair Allocation of
  Multiple Resource Types", NSDI 2011. The natural metric for the
  SPEC's fairness question once more than one resource matters.
- Xiao et al., "Gandiva: Introspective Cluster Scheduling for Deep
  Learning", OSDI 2018, and Gu et al., "Tiresias: A GPU Cluster Manager
  for Distributed Deep Learning", NSDI 2019. GPU-aware scheduling for
  training jobs, far beyond the device-count fit check here.
- Kubernetes documentation (kubernetes.io): kube-scheduler scoring,
  Taints and Tolerations, Resource Quotas, and the Operator pattern.
  The reference behaviour each level simplifies.
- Kueue (kubernetes-sigs/kueue) and KServe (kserve.github.io): the
  job-queueing and model-serving projects SPEC.md names; level 2 only
  mirrors what a KServe InferenceService declares.

Novelty: none is claimed beyond a cleanly labelled, fully reproducible
teaching model with an in-browser twin proven equal to it. NOVELTY.md
remains a draft until its own claim-check gate passes.

## Future work (ROADMAP.md, v1.1 backlog)

Status: v1.0 shipped 2026-11-05 (Learn, Build, and compressed
Deep DONE). This file names the rest of the v2 Deep scope that
the December compression did not build, so no reader mistakes
the compressed Deep for the full scope. Nothing in this file is
built, and nothing here is claimed as a result.

## v1.1 backlog (named, not built)

1. Real cluster proof: run the operator against a real kind or
   k3d cluster on the fleet nodes (BlackBoxV2, BlackBoxV3, Dell
   R610), with the CRD applied as YAML to a real API server.
2. Real version upgrade: one Kubernetes version upgrade on the
   real drill cluster, logged step by step, replacing the
   simulated upgrade in level-3-deep.
3. Rolling update strategy: replace endpoint pods with an
   availability guard (never below a declared ready count),
   instead of replace in name order only.
4. Admission and validation: a validating path for the CRD
   (version strings, replica bounds, request bounds), beyond the
   in-code object used by the simulation.
5. Multi endpoint operator scope: more than one ModelEndpoint,
   more than one namespace, with conflict and quota interaction
   against the Build namespace quotas.
6. Real cost data: replace the modelled, illustrative cost page
   with measured fleet power and capacity figures, or a real
   cloud bill extract, clearly sourced and dated.
7. Failure injection on a real cluster: pod kills, node drain
   under load, and a tested rollback of a failed upgrade, not
   only the simulated branches proven at v1.0.
8. Observability: controller metrics and a reconcile log shipped
   outside the runner output (events, timing, error counts).

### Order

Items 1 and 2 close the largest v1.0 deduction (simulated only)
and come first. Items 3 to 5 deepen the operator. Items 6 to 8
close the cost and operations gaps. Each item closes only on
evidence: code, tests, numbers, links.
