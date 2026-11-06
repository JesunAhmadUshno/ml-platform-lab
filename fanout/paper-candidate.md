# Paper candidate brief: GPU scheduling fairness notes for small simulated clusters

Project: P20 ml-platform-lab
Status: CANDIDATE, brief dated 2026-11-05
Submission note: submission is Jesun's tap. Nothing is submitted by
this brief, and no venue has been contacted.

## Working title

What a simulated platform teaches about GPU scheduling, quotas,
and operator reconciliation at small scale, and what it cannot
teach

## Candidate claim, in one line

A standard-library simulation with hand-computed oracles can
teach and test the scheduling, quota, and reconciliation rules of
an ML platform exactly, while proving nothing about real cluster
behaviour; the claim is the teaching and testing discipline, not
platform performance, because every level is simulated and no
real cluster was contacted.

## Abstract draft

Based only on the measured v1.0 results recorded in the repo.
Scope limits are stated inside the abstract, not after it.

ML platform operations are usually learned on real clusters,
where the rules are hard to isolate. This candidate reports a
three level open study built entirely as a simulation. Learn
modelled pods, deployments, services, and config maps over 3
simulated nodes: 10 pods created, 7 Running, 1 Pending, 2
Deleted, with a ConfigMap rollout leaving 2 pods stale at
MAX_BATCH 8 and 1 fresh at 16. Build added jobs, GPU scheduling
under nodeSelector and taint rules, namespace quotas, and a
KServe-style endpoint: 11 pods admitted, 2 quota rejections, 3
jobs at 2 Succeeded and 1 Failed over 5 attempts, 2 retries, and
9 ticks, with plain and KServe-style services at 2 endpoints
each. Deep modelled a ModelEndpoint operator: 4 reconcile passes,
9 actions, a v1 to v2 upgrade in 1 log entry, drift healing for
three injected faults, and a simulated cluster upgrade from 1.29
to 1.30 in 11 steps with 4 pre-checks and 4 post-checks passing.
Every expected value was hand-computed from the documented rules
before the run and asserted by 96 checks. No real cluster,
container, GPU hardware, or version upgrade was contacted or
run, the KServe-style object is a model of KServe, and the cost
page uses invented unit prices. The candidate claims the
reproducible rule teaching and the oracle-first test method on
these scenarios, not real-world platform performance. The SPEC
paper angle, a GPU scheduling note for small clusters on what
Kueue-style fairness does at two-GPU scale, is named as future
work: this v1.0 has no fairness policy and no real two-GPU run.

## Method outline

1. Learn simulation. Lowest-utilisation placement among fitting
   nodes, ties by node name; deployment reconcile; selector
   endpoints with round robin routing; config snapshot at pod
   creation.
2. Build platform. Requests-only scheduling, limits recorded;
   GPU devices as whole units gated by nodeSelector and taint
   tolerations; quota over active pod requests; job attempts as
   fresh pods with bounded retries.
3. Deep operator. Desired against live pod set in sorted name
   order; create, replace, delete; idempotence proven by a zero
   action second pass; drift injected outside the controller.
4. Simulated upgrade. Pre-checks, an ordered 11 step list,
   post-checks, and a rollback note; the failure branch proven by
   an isolated unhealthy-endpoint test.
5. Determinism. All three results files are byte-identical
   across runs; the scenarios carry no wall-clock fields.

## Results table

Simulated 2026-11-05, Muse VM, Python 3.12, from the level
READMEs and results files in the repo.

| Item | Result |
| --- | --- |
| Learn | 10 pods, 7 Running, endpoints 3, 4750m cpu and 4864 MiB running |
| Build | 11 admitted, 2 rejections, jobs 2 Succeeded and 1 Failed, 5 attempts, 9 ticks |
| Deep operator | 4 passes, 9 actions, final 3 pods all at v2, 1500m cpu and 3072 MiB |
| Deep upgrade (simulated) | 1.29 to 1.30, 11 steps, 4 and 4 checks pass, no rollback |
| Tests | 96 checks in total, plus the scaffold smoke test |

## Limits a reviewer will raise, stated first

- Simulated only: no real cluster behaviour is evidenced.
- No fairness policy: the SPEC paper angle on Kueue-style
  fairness is not implemented at v1.0.
- One small designed scenario per level; no load or scale test.
- KServe-style object is a model, not KServe or Ray Serve.
- Cost page is modelled with invented prices.
- Single site: Muse VM on CPU, not the assigned fleet nodes.

## What would strengthen the candidate

Each item is v1.1 backlog in ROADMAP.md, not done work: the real
cluster proof, a real version upgrade, a fairness policy run at
two-GPU scale, and real cost data.

## Venue note

No venue is named as submitted or contacted. Venue choice and
any submission click are Jesun's tap only.
