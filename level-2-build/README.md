# Level 2, Build: ml-platform-lab

Status: DONE 2026-11-05 (early, Sprint 4 pull). A Build-level
extension of the Learn simulation, stdlib only, run on the Muse VM.
Simulated and labelled as such everywhere: the toolchain check on
this VM found no kubectl, no kind, no k3d, and no docker, nothing
was installed, and no real cluster, container, or GPU hardware was
contacted or run. Node names and capacities are teaching values
standing for fleet CPU and GPU pool roles, not measured live
cluster state. Full scope and rules: BUILD-SPEC.md in this folder.

Code: platform.py (nodes with labels and taints, namespaces with
quotas, pods with requests and limits, jobs, services, and a
KServe-style InferenceService), run_build.py (the designed
scenario, writes results_build.json), tests in
tests/test_build_platform.py (39 checks, every expected value
hand-computed from the documented rules before the run).

## What Build adds over Learn

### Jobs with a lifecycle
A job moves Queued, Running, then Succeeded or Failed. Each attempt
is a fresh pod, scheduled at attempt time. A failed attempt retries
while retries stay within max_retries. In the scenario: train-v1
(the training workload standing for the P19 training job) succeeds
in 1 attempt over 3 ticks; train-flaky fails attempt 1 and succeeds
on its retry; train-doomed always fails and ends Failed after 2
attempts and 1 retry. Totals: 5 attempts, 2 retries, 9 ticks.

### Requests and limits, enforced
Every pod declares cpu and memory requests and limits. Admission
rejects a pod whose limit is below its request (proven by an
isolated test). The scheduler places pods by requests only, the
Kubernetes rule; limits are recorded on every pod in
results_build.json.

### GPU scheduling
GPU pods request whole devices and carry a nodeSelector
(accelerator nvidia-t4) and a toleration for the GPU nodes
gpu=true NoSchedule taint. First attempts land train-v1-0 on
node-gpu-a (tie at zero utilisation, broken by name) and
train-flaky-0 on node-gpu-b. The retry pod train-flaky-1 lands on
node-gpu-a after earlier attempts freed both GPU nodes. A pod with
the GPU selector and no toleration (gpu-curious) stays Pending,
naming both failure categories. An isolated test exhausts all 3
cluster GPU devices and shows the fourth GPU pod Pending.

### Namespaces and quotas for multi-tenancy
team-train (quota 24000m cpu, 49152 MiB, 2 GPU, 10 pods),
team-serve (8000m, 16384 MiB, 1 GPU, 6 pods), and team-sandbox
(2000m, 4096 MiB, 0 GPU, 3 pods). Quota counts the requests of
active pods (Running or Pending); terminal pods free their quota.
Two admissions are rejected by quota in the scenario: a third
team-train GPU job (used 2 plus requested 1 over quota 2) and a
sandbox GPU pod against a 0 GPU quota. At admission peak,
team-train holds 23000m across 4 active pods and team-serve holds
5500m across 5.

### Plain Service beside a KServe-style InferenceService

| Aspect | Plain Service | KServe-style InferenceService |
| --- | --- | --- |
| Backing object | Service serve-plain-svc | InferenceService serve-kserve |
| Model declared | No | Yes, tiny-gpt |
| Storage URI declared | No | Yes, a simulated string, nothing downloaded |
| Autoscaling bounds | No | Yes, min 1 and max 3 replicas, declared only |
| Pods | serve-plain-0, serve-plain-1 (1000m, 2048 MiB each) | serve-kserve-predictor-0, serve-kserve-predictor-1 (1500m, 3072 MiB each) |
| Endpoints | 2 | 2 |
| Routing, 10 requests | 5 per endpoint | 5 per endpoint |

The plain endpoint stands for the P03 serving endpoint, as SPEC.md
Build names it. The difference the table shows is the point of the
level: the InferenceService is a model declaration (model, storage,
predictor spec, scaling bounds) that creates pods and a service,
while the plain Service is only a stable name in front of pods
someone else created. Neither one here is the real KServe or a
real P03 endpoint.

## Measured results (simulated)

Method: python3 level-2-build/run_build.py on the Muse VM
(Python 3.12, stdlib only). The scenario is deterministic and
carries no wall-clock fields; results_build.json is byte-identical
across two runs (sha256
ac76dd55db3b5a45bbdcaeb47e67844f3f62d92527dfcd449d3824f6733df6cf).

| Measure | Value |
| --- | --- |
| Pods admitted | 11 |
| Admission rejections (both quota) | 2 |
| Pods Running at end | 4 |
| Pods Succeeded at end | 2 |
| Pods Failed at end | 3 |
| Pods Pending at end | 2 |
| Jobs Succeeded / Failed | 2 / 1 |
| Job attempts / retries / ticks | 5 / 2 / 9 |
| GPU pods placed | 3, on node-gpu-a and node-gpu-b |
| Plain endpoints / KServe endpoints | 2 / 2 |
| Total Running requests at end | 5000m cpu, 10240 MiB memory |

Final node usage: node-cpu-a 2500m and 5120 MiB (serve-plain-1,
serve-kserve-predictor-1); node-cpu-b 2500m and 5120 MiB
(serve-plain-0, serve-kserve-predictor-0); both GPU nodes at 0,
because every job pod is terminal at the end and terminal pods
free their nodes. Final running namespace usage: team-serve
5000m and 10240 MiB over 4 pods; team-train and team-sandbox at 0.

Summary claim: Build ran a stdlib simulated ML platform scenario on the Muse VM: 11 pods admitted and 2 admission rejections, 3 training jobs finishing 2 Succeeded and 1 Failed over 5 attempts with 2 retries and 9 ticks, GPU pods placed on node-gpu-a and node-gpu-b under nodeSelector and taint toleration rules, plain and KServe-style services each with 2 endpoints routing 10 requests at 5 per endpoint, final Running totals 4 pods using 5000m cpu and 10240 MiB memory, and 39 hand-computed Build checks passing alongside the 28 Learn checks and the scaffold smoke test.

CI note, stated honestly: CI now runs the full suite (scaffold
smoke, 28 Learn checks, 39 Build checks) on Python 3.11 and 3.12,
extended from the scaffold smoke-only CI in the same script style.
The local full suite remains the merge gate together with CI.

## What this level does not do

No real cluster, containers, or GPU hardware. The P19 training job
and the P03 serving endpoint are not run; simulated workloads stand
for them and are labelled as such. No Ray Serve (the KServe-style
option in SPEC.md was chosen). Autoscaling bounds are declarations
only; no autoscaler acts on them. No operator or CRD controller:
that is Deep scope.
