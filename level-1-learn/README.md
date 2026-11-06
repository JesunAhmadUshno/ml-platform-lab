# Level 1, Learn: ml-platform-lab

Status: DONE 2026-11-05 (early, Sprint 4 pull). A stdlib teaching
simulation of the four core Kubernetes objects named in SPEC.md, run
on the Muse VM. Simulated and teaching only: no kind, k3d, or cloud
cluster was contacted, and no live fleet state is claimed. Node names
stand for the fleet nodes (BlackBoxV2, BlackBoxV3, Dell R610) and
their capacities are teaching values, not measurements.

Code: cluster.py (the simulated cluster), run_learn.py (the designed
scenario, writes results_learn.json), tests in
tests/test_learn_platform.py (28 checks, every expected value
hand-computed from the documented rules before the run).

## The four objects, in plain words

### Pod
What it is: the smallest unit of work. One pod asks for cpu and
memory, carries labels, and runs on exactly one node.
What breaks without it: nothing runs at all. Every higher object in
this level exists only to create, place, find, or configure pods.
In the scenario: 10 pods are created across the run.

### Deployment
What it is: a promise about a count. A deployment declares how many
replicas of a pod should exist and works to keep that true.
What breaks without it: a deleted or crashed pod stays gone and the
service quietly loses capacity until a human notices.
In the scenario: deleting api-1 drops the api deployment to 2 live
pods; reconcile creates api-3 and the count returns to 3. Scaling the
worker deployment from 2 to 3 creates worker-2 the same way.

### Service
What it is: a stable name and port in front of a changing set of
pods. Its endpoints are the Running pods whose labels match its
selector, and requests route across them round robin.
What breaks without it: callers must track pod names that change on
every recreate, so the first self-heal breaks every caller.
In the scenario: service api-svc (port 80 to target port 8080,
selector app api) starts with endpoints api-0, api-1, api-2, routes
6 requests as 2 per endpoint, and after the heal and the rollout its
endpoints are api-2, api-3, api-4. Worker pods never appear, because
the selector matches labels, not wishes.

### ConfigMap
What it is: key and value configuration kept outside the pod, so the
same workload can run with different settings.
What breaks without it: config is baked into each workload copy, and
changing one value means rebuilding and redeploying everything.
The sharp edge, proven in the scenario: a pod snapshots the ConfigMap
at creation time. Editing api-config (MAX_BATCH 8 to 16) changes no
running pod. All 3 running api pods stay stale at 8 until one is
deleted; its replacement api-4 is the first pod carrying 16. The
final count is 2 stale pods and 1 fresh pod. Config changes reach
pods through recreation, never by magic.

### The scheduler and the node (supporting ideas)
A pod that fits nowhere waits. The scenario scheduler places each
pod on the node with the lowest cpu utilisation among nodes that fit
its cpu and memory requests, ties broken by node name. The pod named
huge asks for 16000m, more cpu than any single node holds, so it
stays Pending with the reason recorded. Requests are promises the
scheduler must be able to keep; an impossible request is a queue,
not an error that fixes itself.

## Measured results (simulated, teaching)

Initial placement, from the rule by hand and confirmed by the run:
api-0 on node-r610, api-1 on node-v2, api-2 on node-v3, worker-0 on
node-r610, worker-1 on node-v2, debug on node-v3.

Final node usage: node-r610 2000m and 2048 MiB (api-3, api-4,
worker-0); node-v2 1000m and 1024 MiB (worker-1); node-v3 1750m and
1792 MiB (api-2, debug, worker-2). Totals: 4750m cpu and 4864 MiB
memory across 7 Running pods.

Main results claim: Learn ran a stdlib simulated cluster scenario over 3 simulated fleet nodes on the Muse VM: 10 pods created, 7 Running, 1 Pending, 2 Deleted, with initial placement api-0 on node-r610, api-1 on node-v2, api-2 on node-v3, worker-0 on node-r610, worker-1 on node-v2, and debug on node-v3, self-healing recreating deleted api-1 as api-3, worker scaling 2 to 3 creating worker-2 on node-v3, a 16000m pod staying Pending, final service endpoints 3, total running requests 4750m cpu and 4864 MiB memory, and a ConfigMap update leaving 2 api pods stale at MAX_BATCH 8 and 1 fresh at 16 after a one-pod rollout, with 28 hand-computed Learn checks passing plus the scaffold smoke test.

The full per-pod record sits in results_learn.json, which is
byte-identical across two runs (sha256
345791806dc14c4e95cf77a128272e9d27f79a1a0bc47a460243570ce105236f).
Arithmetic was pre-computed by hand: the placement table follows the
utilisation rule step by step in the test file, and the final node
sums (2000 + 1000 + 1750 = 4750m; 2048 + 1024 + 1792 = 4864 MiB)
are asserted there.

CI note, stated honestly: this repo CI is the scaffold smoke test
only. The local full suite (28 Learn checks plus the smoke test) is
the gate for this level, and it passes.

## What this level does not do

No real cluster, no containers, no GPU scheduling, no namespaces or
quotas, no labels, taints, or affinity beyond the one documented
scheduler rule. Those are Build and Deep scope in SPEC.md. The P03
container drill named as the entry ticket in SPEC.md is served here
only as the pod and resource-request model; the real container work
stays with P03 and with P20 Build.

## Grade

Grade: P20 Learn 8,700 of 10,000.
Deductions: small synthetic designed scenario, one 10-pod run
(minus 500); simulated cluster only, no real kind or k3d cluster and
no live fleet nodes contacted (minus 400); run on the Muse VM, not
the assigned fleet cluster nodes BlackBoxV2, BlackBoxV3, and the
Dell R610 (minus 200); scheduler is one documented rule only, no
labels, taints, affinity, or GPU scheduling (minus 100); no
namespaces, resource quotas, or rolling update strategy beyond a
single-pod recreate (minus 100).
Zero-tolerance: PASS (no invented claim, every number measured by
the runner or hand-computed and test-asserted, simulated values
labelled simulated, em dash count 0 in all touched files, scaffold
never graded as a build).
