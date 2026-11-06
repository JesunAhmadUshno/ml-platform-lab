# The Floor the Models Stand On, Simulated Honestly

By Jesun Ahmad Ushno
Date: 2026-11-05
Status: DRAFT, written fan-out for P20 ml-platform-lab v1.0. Not posted.

## The problem

Models get the attention. The platform under them decides whether
they run at all: which node takes a job, which namespace runs out
of quota first, which endpoint stays at the version it declared.
This project teaches that floor by building it, in simulation,
with every number hand-computed before the run and then asserted
by tests.

Repository: https://github.com/JesunAhmadUshno/ml-platform-lab

## Honest scope, stated first

This is a simulated platform. Every level is a Python standard
library simulation run on the Muse VM: simulated jobs, simulated
GPU scheduling, simulated quotas, a KServe-style endpoint that is
a model of KServe and not KServe, and a simulated operator. No
real cluster was contacted at any level. The toolchain check
found no kubectl, kind, k3d, or docker on the VM, nothing was
installed, and no real cluster, container, GPU hardware, operator
deployment, or version upgrade ran. Node names and capacities are
teaching values, not measurements.

## What was built

Learn: the four core objects (Pod, Deployment, Service,
ConfigMap) over 3 simulated fleet nodes, with the ConfigMap sharp
edge proven: a pod snapshots config at creation, so an edit
leaves running pods stale until recreation. Grade 8,700 of 10,000.

Build: jobs with retries, requests and limits, GPU scheduling
with nodeSelector and taint tolerations, namespaces with quotas,
and a plain Service beside a KServe-style InferenceService.
Grade 8,500 of 10,000.

Deep: a simulated ModelEndpoint operator, a simulated cluster
upgrade, a modelled cost page, and written failure modes.
Grade 8,200 of 10,000.

## The main result

On the simulated scenarios, Learn placed 10 pods with 7 Running, Build admitted 11 pods and finished 3 jobs at 2 Succeeded and 1 Failed, and the Deep simulated operator kept chat-endpoint at 3 replicas all at v2 over 4 reconcile passes with 9 actions, all in simulation on the Muse VM with no real cluster contacted.

In detail. Learn: 10 pods created, 7 Running, 1 Pending, 2
Deleted, final endpoints 3, total running requests 4750m cpu and
4864 MiB, and the ConfigMap rollout leaves 2 api pods stale at
MAX_BATCH 8 and 1 fresh at 16. Build: 11 pods admitted, 2 quota
rejections, 5 attempts, 2 retries, 9 ticks, GPU pods placed on
node-gpu-a and node-gpu-b, plain and KServe-style services at 2
endpoints each routing 10 requests at 5 per endpoint, final
Running 4 pods at 5000m cpu and 10240 MiB. Deep: 4 reconcile
passes with 9 actions (4 creates, 4 replaces, 1 delete), pass 2
idempotent at 0 actions, version upgrade v1 to v2 in 1 log entry,
drift healing for a deleted pod, a tampered pod, and an extra
pod, final 3 pods all at v2 at 1500m cpu and 3072 MiB, simulated
cluster upgrade 1.29 to 1.30 in 11 steps with 4 pre-checks and 4
post-checks passing and no rollback, and a modelled illustrative
cost of 130 USD per month on invented unit prices.

## The verdict

The simulation teaches the rules a real cluster enforces:
requests are promises the scheduler must keep, quota counts
active pods, config reaches pods through recreation, and a
controller that is not idempotent churns pods forever. It does
not prove any of it on real infrastructure. That proof is the
first v1.1 item, named in ROADMAP.md.

## Limits

- Simulated only: no real cluster, containers, or GPU hardware.
- The P19 training job and the P03 serving endpoint are simulated
  stand-ins, not the real workloads.
- One small designed scenario per level.
- Run on the Muse VM, not the assigned fleet cluster nodes.
- Cost figures are modelled with invented unit prices.
- Replaces run in name order, with no rolling update guard.

## Future

The v1.1 backlog is ROADMAP.md in the repo: real cluster proof,
a real version upgrade, rolling update strategy, admission and
validation, multi endpoint scope, real cost data, failure
injection on a real cluster, and observability. None of that is
claimed as done.

Tests: 96 checks in total (28 Learn, 39 Build, 29 Deep), plus
the scaffold smoke test.
