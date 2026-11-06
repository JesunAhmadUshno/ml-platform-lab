# LinkedIn post draft: P20 ml-platform-lab v1.0

Status: DRAFT NOT POSTED
Date drafted: 2026-11-05
Author: Jesun Ahmad Ushno
Rule for this platform: the link goes in the first comment, not in the
post body. The first comment line is at the end of this file.

## Post body

The models get the attention. The platform under them decides
whether they run at all. I built that platform as a simulation,
and labelled it simulated everywhere.

ml-platform-lab v1.0 is done: Learn, Build, and Deep, all open,
Python standard library only.

The scope, up front: this is a simulated platform. Simulated
jobs, simulated GPU scheduling, simulated quotas, a KServe-style
endpoint that models KServe, and a simulated operator. No real
cluster was contacted. That limit is in the post, not under it.

Learn: 10 pods created, 7 Running, 1 Pending, 2 Deleted, final
endpoints 3, and the ConfigMap lesson proven: running pods stay
stale at MAX_BATCH 8 until recreation, 2 stale and 1 fresh at 16.

Build: 11 pods admitted, 2 quota rejections, 3 jobs finishing 2
Succeeded and 1 Failed over 5 attempts and 9 ticks, GPU pods on
both GPU nodes, plain and KServe-style services at 2 endpoints
each, final Running 4 pods at 5000m cpu and 10240 MiB.

Deep: a simulated operator keeps chat-endpoint at 3 replicas,
all at v2, over 4 reconcile passes with 9 actions, heals a
deleted pod, a tampered pod, and an extra pod, and runs a
simulated cluster upgrade 1.29 to 1.30 in 11 steps. Modelled
cost: 130 USD per month, illustrative only.

Grades, house scale: Learn 8,700, Build 8,500, Deep 8,200 of
10,000. 96 checks in total, plus the smoke test. The real cluster
proof is the first v1.1 item, and it is not claimed here.

What did your first real cluster teach you that no simulation
could?

## First comment (post this as the first comment, per the standing rule)

Repo, releases v0.1, v0.5, and v1.0, and the full tutorial: https://github.com/JesunAhmadUshno/ml-platform-lab
