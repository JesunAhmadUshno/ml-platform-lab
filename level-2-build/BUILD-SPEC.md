# BUILD-SPEC: ml-platform-lab (P20), Level 2 Build

Status: written before the Build code, 2026-11-05. This spec extends
the Learn simulation. It does not replace SPEC.md.

## Honest constraint, checked first

Toolchain check on the Muse VM, 2026-11-05: kubectl not found, kind
not found, k3d not found, docker not found. Nothing was installed
(FREE-ONLY, install nothing). There is no real kind or k3d cluster
available on this VM, so no real cluster run is claimed anywhere in
this level. Build extends the Learn teaching simulation into a
Build-level system, simulated and labelled as such in every file.
Node names and capacities are teaching values that stand for fleet
roles (CPU pool, GPU pool), not measured live cluster state.

## Scope (from SPEC.md Build, register item 481 included)

1. Job lifecycle: a workload moves Queued, Running, Succeeded, or
   Failed. A failed attempt retries up to the job max_retries
   (backoffLimit style). Every attempt is a new pod, scheduled fresh.
   The job record keeps attempts, retries, ticks, and pod names.
2. Two workload kinds on the simulated cluster:
   - a training job workload (stands for the P19 training job), and
   - a serving endpoint workload (stands for the P03 serving
     endpoint), as a plain Service in front of deployment pods.
   Both declare resource requests and limits. The scheduler places
   pods by requests only (the Kubernetes rule). Admission rejects a
   pod whose limit is below its request.
3. GPU scheduling: pods request whole GPU devices. A node advertises
   a GPU count and labels (accelerator, pool). GPU nodes carry a
   NoSchedule taint. A pod lands on a GPU node only when its
   nodeSelector matches the node labels and it tolerates the taint
   and a GPU device is free.
4. Namespaces and limits for multi-tenancy: each namespace carries a
   resource quota (cpu, memory, gpu, pod count) over the requests of
   its active pods (Running or Pending). Admission rejects a pod
   that would push its namespace over quota, with the binding
   resource named. Terminal pods (Succeeded, Failed, Deleted) free
   their quota and node resources.
5. One KServe-style endpoint beside the plain one: an
   InferenceService object declaring model name, storage URI
   (a simulated string, nothing is downloaded), predictor pod spec,
   and autoscaling bounds (min and max replicas, target metric).
   Applying it creates predictor pods and a Service. A comparison
   table in the level README and in results_build.json states what
   the InferenceService declares that the plain Service does not.

## Scheduling rule (documented, deterministic)

A node is a candidate when all of these hold: the pod requests fit
the node remaining cpu, memory, and GPU devices (usage counts
Running pods only); every nodeSelector entry matches a node label;
every NoSchedule taint on the node is tolerated by the pod. Among
candidates the pod lands on the lowest cpu utilisation node (used
cpu divided by capacity), ties broken by node name. If no node is a
candidate, the pod stays Pending and its reason names every distinct
failure category seen, sorted. All iteration is over sorted names,
and results carry no wall-clock fields, so two runs of the scenario
produce a byte-identical results_build.json.

## Designed scenario (run_build.py)

Nodes: node-cpu-a and node-cpu-b (8000m, 16384 MiB, 0 GPU, labels
zone cpu and pool general, no taints); node-gpu-a (8000m, 16384 MiB,
2 GPU) and node-gpu-b (8000m, 16384 MiB, 1 GPU), both labelled
accelerator nvidia-t4 and pool gpu, both tainted gpu=true
NoSchedule.

Namespaces: team-train (quota 24000m, 49152 MiB, 2 GPU, 10 pods),
team-serve (quota 8000m, 16384 MiB, 1 GPU, 6 pods), team-sandbox
(quota 2000m, 4096 MiB, 0 GPU, 3 pods).

Order: three training jobs submit their first attempt pods
(train-v1 needs 1 GPU and succeeds in 3 ticks; train-flaky needs
1 GPU, fails attempt 1, succeeds on retry; train-doomed needs no
GPU, always fails, exhausts 1 retry and ends Failed). Then the
plain serving deployment (2 replicas) and the KServe predictor
(2 replicas) are created in team-serve. Then three probes:
train-gpu-blocked asks team-train for a third GPU and is rejected
by quota; sandbox-gpu asks team-sandbox for a GPU against a 0 GPU
quota and is rejected; gpu-curious selects GPU nodes without a
toleration and stays Pending; train-huge asks 16000m and stays
Pending. Jobs then execute in submission order, sequentially, so
retry placement is hand-computable. Finally 10 requests route over
each serving endpoint set.

## Acceptance

- Full test suite passes locally (scaffold smoke, 28 Learn checks,
  plus the new Build checks with hand-computed expected values).
- results_build.json is byte-identical across two runs.
- Every number in the level README comes from the runner output.
- Em dash count is 0 in every touched file.
- CI is extended to run the full suite in the same script style as
  the scaffold CI, on Python 3.11 and 3.12. Bot reviews are
  advisory only, never gates.

## Out of scope

No real cluster, containers, or GPU hardware. No Ray Serve (the
KServe-style option from SPEC.md was chosen). No operator or CRD
controller (Deep scope). No rolling update, no HPA actuation: the
InferenceService records autoscaling bounds as declarations only.
