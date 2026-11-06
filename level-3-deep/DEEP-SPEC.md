# DEEP-SPEC: ml-platform-lab (P20), Level 3 Deep (compressed)

Status: written before the Deep code, 2026-11-05. This spec extends
the Learn and Build simulations. It does not replace SPEC.md.

## Honest constraint, checked first

Toolchain check carried from Build, 2026-11-05: kubectl not found,
kind not found, k3d not found, docker not found on the Muse VM.
Nothing was installed (FREE-ONLY, install nothing). There is no real
cluster available on this VM, so no real cluster run, no real
operator deployment, and no real cluster upgrade is claimed anywhere
in this level. Deep extends the labelled simulation with an operator
model, simulated and labelled as such in every file.

## Compressed Deep scope (exactly this)

1. A tiny operator inside the labelled simulation: one CRD and a
   controller that keeps a model endpoint at a declared version,
   with a version upgrade log.
2. One simulated Kubernetes version upgrade of the drill cluster,
   logged step by step, with pre-checks, post-checks, and a rollback
   note. Labelled simulated.
3. A cost and failure page: cost figures labelled modelled and
   illustrative only, plus a failure-modes section.
The rest of the v2 Deep scope goes into ROADMAP.md at repo root as
the named v1.1 backlog.

## Design

Module: level-3-deep/deep_operator.py (named to avoid shadowing the stdlib operator module), stdlib only.

- ModelEndpoint is the CRD object: name, namespace, model, declared
  version, replicas, and per-pod cpu and memory requests. Its spec
  dict is recorded in the runner output.
- EndpointPod is one pod owned by the endpoint: name, version,
  status (Running), and resource requests copied from the CRD.
- Controller holds the live pod set for one endpoint and a full
  action log. One reconcile pass compares desired state (replicas
  pods, each at the declared version, named endpoint-0 to
  endpoint-(replicas-1)) with live state, in sorted pod-name order:
  a missing desired pod is created at the declared version, a live
  desired pod at the wrong version is replaced at the declared
  version, an extra pod beyond the desired set is deleted, and a
  correct pod is kept with no mutating action. Every mutating action
  is appended to the log with a 1-based sequence number, the pass
  number, the action, the pod name, and the from and to versions.
  A reconcile pass with no drift records zero actions, which proves
  idempotence.
- set_version changes the declared version on the CRD and appends
  one entry to the version upgrade log (endpoint name, from version,
  to version). The following reconcile pass does the pod replaces.
- ClusterUpgrade models the drill cluster: a control plane version
  and a list of nodes, each with a kubelet version and a Ready flag.
  run_upgrade runs fixed pre-checks, an ordered step list, and fixed
  post-checks, and returns a full log. No step contacts a real node.

## Hand-computed oracle (written before any run)

Endpoint: chat-endpoint, namespace team-serve, model tiny-gpt,
replicas 3, per-pod 500m cpu and 1024 MiB memory.

Pass 1, apply at version v1: desired pods chat-endpoint-0, -1, -2
are all missing, so the controller creates 3 pods, all at v1.
Actions in pass 1: 3 creates, sequence 1 to 3. Live state after
pass 1: 3 pods, all v1, all Running.

Pass 2, reconcile again with no change: 0 actions. Total actions
stay 3. This is the idempotence check.

Version change: set_version from v1 to v2 appends exactly 1 entry
to the version upgrade log.

Pass 3, reconcile after the version change: all 3 pods are at v1
while the declared version is v2, so the controller replaces 3
pods, one per pod in name order. Actions in pass 3: 3 replaces,
sequence 4 to 6. Live state after pass 3: 3 pods, all v2.

Drift injection (outside the controller, not logged as controller
actions): pod chat-endpoint-1 is deleted, pod chat-endpoint-2 is
tampered to version v1, and an extra pod chat-endpoint-99 at v2 is
added. Live state before pass 4: chat-endpoint-0 at v2 (correct),
chat-endpoint-1 missing, chat-endpoint-2 at v1 (wrong version),
chat-endpoint-99 at v2 (extra).

Pass 4, reconcile after drift: in sorted desired order, -0 is kept
(no action), -1 is created at v2 (1 create), -2 is replaced from
v1 to v2 (1 replace); then the extra pod -99 is deleted (1 delete).
Actions in pass 4: 3 actions (1 create, 1 replace, 1 delete),
sequence 7 to 9. Live state after pass 4: exactly 3 pods,
chat-endpoint-0, -1, -2, all at v2, all Running.

Totals for the endpoint scenario: 4 reconcile passes, 9 mutating
controller actions (4 creates, 4 replaces, 1 delete), 1 version
upgrade log entry, final declared version v2, final live versions
all v2, final running requests 1500m cpu and 3072 MiB memory
(3 pods at 500m and 1024 MiB).

Cluster upgrade oracle: drill cluster with control plane at 1.29
and 3 nodes (cp-0, worker-0, worker-1), each kubelet at 1.29 and
Ready. Target version 1.30.
Pre-checks, 4, all pass: control plane at 1.29 (expected start),
all nodes Ready (3 of 3), kubelet skew within one minor (all at
1.29), endpoint healthy before upgrade (3 pods at declared v2).
Steps, 11, in this exact order: pre-checks complete; backup etcd
snapshot (simulated); upgrade control plane cp-0 from 1.29 to
1.30; upgrade kubelet on cp-0 from 1.29 to 1.30; drain worker-0;
upgrade kubelet on worker-0 from 1.29 to 1.30; uncordon worker-0;
drain worker-1; upgrade kubelet on worker-1 from 1.29 to 1.30;
uncordon worker-1; post-checks complete.
Post-checks, 4, all pass: control plane at 1.30, all kubelets at
1.30 (3 of 3), all nodes Ready (3 of 3), endpoint still healthy
(3 pods at declared v2). Rollback triggered: false. Final cluster
version: 1.30 on the control plane and on all 3 kubelets.

Cost model oracle (modelled, illustrative only): the model prices
the simulated drill cluster, not any real bill. Assumptions, all
stated in the output: 3 nodes at a modelled 40 USD per node per
month equals 120 USD; endpoint pods use 1500m of a modelled
8000m node capacity, priced inside the node cost, so no separate
pod charge; storage modelled at 10 USD per month; total modelled
cost 130 USD per month. These are teaching numbers with invented
unit prices, labelled modelled and illustrative in every surface.
No real cloud price and no real spend is claimed.

## Acceptance

- Full test suite passes locally (scaffold smoke, Learn checks,
  Build checks, plus the new Deep checks with the hand-computed
  expected values above).
- results_deep.json is byte-identical across two runs (no
  wall-clock fields, all iteration over sorted names).
- Every number in the level README comes from the runner output.
- Em dash count is 0 in every touched file.
- CI is extended to run Deep tests and the Deep runner in the same
  style as the existing CI, on Python 3.11 and 3.12. Bot reviews
  are advisory only, never gates.

## Out of scope

No real cluster, operator deployment, or version upgrade. No
admission webhooks, no CRD YAML applied to a real API server, no
rolling update strategy beyond replace in name order, no multi
endpoint or multi tenant operator scope, no real cost data. Those
items are named in ROADMAP.md as the v1.1 backlog.
