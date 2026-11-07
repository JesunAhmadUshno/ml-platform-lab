# Research review: ml-platform-lab (P20)

Reviewed 2026-11-07 against a PhD-level rubric for an engineering and
teaching simulation. Scores are out of 10 and are the reviewer's
judgement, not a measurement. The self-assigned grades in
docs/index.md (8,700, 8,500 and 8,200 of 10,000) are self-assessed and
are not used here.

Bottom line: a careful, deterministic, honestly labelled teaching
simulation with hand-computed tests. Its weakest points are external
validity (nothing ran on a real cluster) and measurement (no figure
comes from a real system). Overall: about 5 of 10 before this change,
about 5.5 of 10 after it. The cheap gaps are now closed; the remaining
ones need a real cluster or a scope decision, each named below.

## Scores by criterion

| Criterion | Score | Evidence | Status after this change |
| --- | --- | --- | --- |
| Research question | 4 | SPEC.md states the scope (core objects, GPU scheduling, a tiny operator) and a paper angle: "what Kueue-style fairness does at two-GPU scale". The shipped work answers the teaching scope, not the paper question. | Open: needs a scope decision (see gap 4). |
| Hypotheses | 3 | No falsifiable hypothesis is stated; the levels are demonstrations with designed scenarios. | Open: tied to gap 4. |
| Method | 6 | Rules are written down (lowest cpu utilisation, ties by name; admit, validate, quota, schedule; reconcile create, replace, delete in name order) and implemented in stdlib Python. | Improved: the same rules now run in the browser, proven equal to the Python at build time. |
| Baselines and comparison | 3 | The only comparison is plain Service vs KServe-style InferenceService, by what each declares. No comparison with the real kube-scheduler, Kueue, or controller-runtime. | Open: gap 3. |
| Statistics and uncertainty | N/A (justified) | Every model is deterministic with declared outcomes, so there is no sampling variance to report. Uncertainty only arises once real measurements exist (gap 2). | Not applicable until measurement exists. |
| Reproducibility | 8 | Deterministic runners, byte-identical results files, CI reruns and diffs them on Python 3.11 and 3.12. | Fixed: `python3 -m pytest` failed at collection (level-2-build/platform.py shadows the stdlib platform module). tests/conftest.py fixes collection without renaming any file. |
| Validation | 5 | 96 hand-computed checks, but each level checks one designed scenario only. | Fixed: tests/test_invariants.py adds seeded randomized property checks (200 runs x 25 steps per level): no node over-commit, no quota overrun, nodeSelector and taint rules hold for every Running pod, reconcile converges from arbitrary drift and is idempotent. The dashboard runs the same properties live, labelled as a new check. |
| Threats to validity | 6 | Every results file and README labels the work as simulated; failure modes are written for Deep. | Improved: the dashboard and this file list the threats explicitly (below). |
| Related work | 2 | NOVELTY.md is a DRAFT with one prior-art row and "NO MEASUREMENT YET". | Improved: related work reviewed below with citations. NOVELTY.md itself stays a draft, as its own gate requires. |
| Limitations | 7 | Each level README has a "What this level does not do" section; ROADMAP.md names the v1.1 backlog. | Kept, and surfaced on the dashboard. |

## Gaps fixed in this change

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
5. Labelling: grades are shown as self-assessed, NOVELTY as DRAFT and
   unverified, the cost model as modelled with invented prices, and
   every recorded table as recorded scenario output.
6. Related work: reviewed below.

## Gaps that remain, and what each one needs

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

## Threats to validity

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

## Related work

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
