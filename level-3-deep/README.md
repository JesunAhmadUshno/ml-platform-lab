# Level 3, Deep: ml-platform-lab

Status: DONE 2026-11-05 (early, Sprint 4 pull). A Deep-level
extension of the Learn and Build simulations, stdlib only, run on
the Muse VM. Simulated and labelled as such everywhere: the
toolchain check on this VM found no kubectl, no kind, no k3d, and
no docker, nothing was installed, and no real cluster, operator,
CRD application, container, or version upgrade was contacted or
run. The full v2 Deep scope beyond this compressed level sits in
ROADMAP.md at repo root as the named v1.1 backlog. Full scope,
rules, and the hand-computed oracle: DEEP-SPEC.md in this folder.

Code: deep_operator.py (the ModelEndpoint CRD object, the
controller, the simulated cluster upgrade, and the cost model;
named deep_operator to avoid shadowing the stdlib operator
module), run_deep.py (the designed scenario, writes
results_deep.json), tests in tests/test_deep_platform.py
(29 checks, every expected value hand-computed from the oracle in
DEEP-SPEC.md before the run).

## The operator

### The CRD: ModelEndpoint
One custom resource declares the whole endpoint: name
chat-endpoint, namespace team-serve, model tiny-gpt, a declared
version, 3 replicas, and per-pod requests of 500m cpu and
1024 MiB memory. Changing the declared version is the only input
the operator needs; everything below follows from it.

### The controller
One reconcile pass compares the desired pod set (chat-endpoint-0,
-1, -2, each at the declared version) with the live set, in sorted
name order. A missing pod is created at the declared version, a
pod at the wrong version is replaced at the declared version, an
extra pod is deleted, and a correct pod is kept with no action.
Every mutating action is logged with a sequence number, the pass
number, and its from and to versions.

| Pass | What happened | Actions |
| --- | --- | --- |
| 1 | Apply at v1 | 3 creates |
| 2 | Reconcile again, no change | 0 (idempotent) |
| 3 | Declared version upgraded to v2 | 3 replaces, v1 to v2 |
| 4 | Drift healed (see below) | 1 create, 1 replace, 1 delete |

### The version upgrade log
Setting the declared version from v1 to v2 appends exactly 1 entry
to the version upgrade log (endpoint chat-endpoint, from v1, to
v2). Pass 3 then replaces all 3 pods from v1 to v2, one per pod in
name order, sequences 4 to 6 in the action log.

### Drift healing, proven
Drift is injected outside the controller: chat-endpoint-1 is
deleted, chat-endpoint-2 is tampered back to v1, and an extra pod
chat-endpoint-99 at v2 appears. Pass 4 keeps the correct
chat-endpoint-0, recreates chat-endpoint-1 at v2, replaces
chat-endpoint-2 from v1 to v2, and deletes chat-endpoint-99.
Final state: exactly 3 pods, all at v2, all Running.

## Simulated cluster version upgrade, 1.29 to 1.30

Labelled simulated: no node was drained, upgraded, or contacted.
The drill cluster is a control plane plus 3 nodes (cp-0, worker-0,
worker-1), each kubelet at 1.29 and Ready at the start.

Pre-checks, 4 of 4 pass: control plane at the start version, all
nodes Ready, kubelet skew within one minor, endpoint healthy
before the upgrade.

Steps, 11, in order: pre-checks complete; backup etcd snapshot
(simulated); upgrade control plane cp-0 from 1.29 to 1.30;
upgrade kubelet on cp-0 from 1.29 to 1.30; drain worker-0;
upgrade kubelet on worker-0 from 1.29 to 1.30; uncordon worker-0;
drain worker-1; upgrade kubelet on worker-1 from 1.29 to 1.30;
uncordon worker-1; post-checks complete.

Post-checks, 4 of 4 pass: control plane at 1.30, all kubelets at
1.30, all nodes Ready, endpoint still healthy (3 pods at v2).
Rollback triggered: no. Rollback note: if a post-check had
failed, the simulated rollback would restore the etcd snapshot
taken in step 2, return the control plane to 1.29, and re-run the
pre-checks before any second attempt. An isolated test proves the
failure branch: with an unhealthy endpoint the pre-check fails
and the upgrade reports Failed.

## Cost page (modelled, illustrative only)

These figures price the simulated drill cluster with invented
unit prices, for teaching only. They are not real cloud prices,
not a real bill, and not real spend.

| Item | Modelled figure |
| --- | --- |
| Nodes | 3 at a modelled 40 USD per node per month |
| Node cost | 120 USD per month |
| Storage | a modelled 10 USD per month |
| Endpoint pods | priced inside the node cost, no separate charge |
| Total modelled cost | 130 USD per month |

What a small cluster teaches that a cloud console hides: the
console shows a monthly total, while the operator sees the units
inside it. Three nodes carry the whole cost whether the endpoint
runs 1 replica or 3, so replica count is a reliability choice
before it is a cost choice at this scale. The expensive failures
are not in the table at all: a version upgrade done without
pre-checks, or drift nobody reconciles, costs an outage, and an
outage has no line in a cost model.

## Failure modes

- Declared version never converges: a controller bug or a pod
  that cannot be replaced leaves live versions split across the
  set. The symptom is a healthy-looking replica count with mixed
  versions. This simulation catches it because the final check
  counts pods at the declared version (3 of 3), not just pods.
- Silent drift: a pod deleted or tampered outside the operator
  stays wrong until the next reconcile. Pass 4 proves recovery
  for one deletion, one tamper, and one extra pod, but only
  because a reconcile pass runs after the drift. Drift between
  passes is invisible in this model, as it is in a real cluster
  without a running controller.
- Non-idempotent reconcile: a controller that acts on correct
  state churns pods on every pass. Pass 2 proves this controller
  takes 0 actions on a converged set.
- Upgrade without pre-checks: upgrading a cluster whose endpoint
  is already unhealthy mixes two failures into one incident. The
  simulated upgrade gates on 4 pre-checks, and the isolated test
  shows the Failed branch when the endpoint check fails.
- Upgrade stuck mid-way: a worker drained and never uncordoned
  leaves the cluster one node down with no error on the endpoint.
  The step log makes the state auditable: 11 named steps, each
  either present in order or visibly missing.
- Rollback as a story, not a procedure: the rollback note names
  the snapshot, the version to return to, and the re-check. In a
  real cluster an untested rollback is a hope, not a plan; this
  level records the procedure but cannot test it for real, and
  says so.
- Cost blindness: modelled prices teach shape, not amounts.
  Anyone quoting the 130 USD figure as a real cluster cost has
  misread this page; it is labelled modelled and illustrative in
  the runner output, the cost model, and this README.

## Measured results (simulated)

Method: python3 level-3-deep/run_deep.py on the Muse VM
(Python 3.12, stdlib only). The scenario is deterministic and
carries no wall-clock fields; results_deep.json is byte-identical
across two runs (sha256
a4ae33de79919695ff8d82a38defde6362cdf0e089230872e6a8b050d12e5c4a).

| Measure | Value |
| --- | --- |
| Reconcile passes | 4 |
| Mutating controller actions | 9 (4 creates, 4 replaces, 1 delete) |
| Idempotence | pass 2 took 0 actions |
| Version upgrade log entries | 1 (v1 to v2) |
| Final pods | 3, all at declared v2, all Running |
| Final running requests | 1500m cpu, 3072 MiB memory |
| Cluster upgrade | 1.29 to 1.30, 11 steps, simulated |
| Pre-checks / post-checks | 4 of 4 pass / 4 of 4 pass |
| Rollback triggered | No |
| Modelled total cost (illustrative only) | 130 USD per month |

Summary claim: Deep ran a stdlib simulated model endpoint operator on the Muse VM: one ModelEndpoint CRD for chat-endpoint (model tiny-gpt, 3 replicas) kept at its declared version by a controller over 4 reconcile passes with 9 mutating actions (4 creates, 4 replaces, 1 delete), including an idempotent second pass with 0 actions, a version upgrade from v1 to v2 recorded in 1 upgrade log entry, and drift healing that recreated a deleted pod, replaced a pod tampered back to v1, and deleted an extra pod, ending with 3 pods all at v2 using 1500m cpu and 3072 MiB memory, plus a simulated drill cluster upgrade from 1.29 to 1.30 in 11 steps with 4 pre-checks and 4 post-checks passing and no rollback, modelled illustrative cost of 130 USD per month, and 29 hand-computed Deep checks passing alongside the 39 Build checks, the 28 Learn checks, and the scaffold smoke test.

CI note, stated honestly: CI now runs the full suite (scaffold
smoke, 28 Learn checks, 39 Build checks, 29 Deep checks) and the
Deep runner on Python 3.11 and 3.12, extended in the same script
style as the existing CI. The local full suite remains the merge
gate together with CI.

## What this level does not do

No real cluster, operator deployment, CRD application, or version
upgrade. No admission webhooks, no rolling update strategy beyond
replace in name order, no availability guard during replaces, no
multi endpoint or multi tenant operator scope, and no real cost
data. Those items are the v1.1 backlog in ROADMAP.md.

## Grade

Grade: P20 Deep 8,200 of 10,000.
Deductions: simulated only, no real cluster, no real operator
deployment, and no real version upgrade (minus 700); one small
designed scenario, a single endpoint with 3 replicas (minus 300);
compressed Deep scope, with the rest of the v2 Deep scope named
as the v1.1 backlog in ROADMAP.md (minus 300); run on the Muse
VM, not the assigned fleet cluster nodes BlackBoxV2, BlackBoxV3,
and the Dell R610 (minus 200); replaces run in name order only,
with no rolling update strategy or availability guard (minus
150); cost figures modelled with invented unit prices, no real
cost data behind the cost page (minus 150).
Zero-tolerance: PASS (no invented claim, every number measured by
the runner or hand-computed and test-asserted, simulated values
labelled simulated, modelled cost labelled modelled and
illustrative, em dash count 0 in all touched files, scaffold
never graded as a build).
