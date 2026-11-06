# Release notes: ml-platform-lab (P20)

One section per release line. Every number below comes from the
level README of that release and the release text on GitHub,
verified with gh release list on 2026-11-05. Every release is a
simulation: no real cluster was contacted at any level, and the
Deep cost page is modelled from invented unit prices. The full
release text lives on the GitHub releases page:
https://github.com/JesunAhmadUshno/ml-platform-lab/releases

## v0.1, Learn (2026-11-05)

- What shipped: a simulated core Kubernetes objects scenario
  (pods, deployments, services, config maps) over 3 simulated
  fleet nodes, standard library only, plus 28 checks and the
  scaffold smoke test.
- Simulated result: 10 pods created, 7 Running, 1 Pending, 2
  Deleted, final endpoints 3, total running requests 4750m cpu
  and 4864 MiB, ConfigMap rollout leaving 2 api pods stale at
  MAX_BATCH 8 and 1 fresh at 16.
- Level grade: 8,700 of 10,000.
- Release: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.1

## v0.5, Build (2026-11-05)

- What shipped: a simulated ML platform with jobs and retries,
  GPU scheduling, namespace quotas, and plain and KServe-style
  services, plus 39 new checks (67 checks in total with Learn).
- Simulated result: 11 pods admitted, 2 quota rejections, 3 jobs
  finishing 2 Succeeded and 1 Failed over 5 attempts, 2 retries,
  and 9 ticks, GPU pods on both GPU nodes, both services at 2
  endpoints routing 10 requests at 5 per endpoint, final Running
  4 pods at 5000m cpu and 10240 MiB.
- Level grade: 8,500 of 10,000.
- Release: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.5

## v1.0, Learn, Build, and Deep (2026-11-05)

- What shipped: a simulated model endpoint operator, a simulated
  cluster upgrade, a modelled cost page, and written failure
  modes, plus 29 new checks (96 checks in total, plus the
  scaffold smoke test). The rest of the v2 scope is named in
  ROADMAP.md as the v1.1 backlog.
- Simulated result: one ModelEndpoint (chat-endpoint, tiny-gpt,
  3 replicas) kept at its declared version over 4 reconcile
  passes with 9 actions (4 creates, 4 replaces, 1 delete),
  version upgrade v1 to v2 in 1 log entry, drift healing for a
  deleted pod, a tampered pod, and an extra pod, final 3 pods
  all at v2 at 1500m cpu and 3072 MiB; simulated cluster upgrade
  1.29 to 1.30 in 11 steps, 4 pre-checks and 4 post-checks
  passing, no rollback; modelled illustrative cost 130 USD per
  month.
- Level grade: 8,200 of 10,000.
- Release: https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v1.0

## Held channels

- Social posts for every release above: HELD under the standing
  platform rules. The loop prepares drafts and never posts;
  Threads needs Jesun's one tap per post.
- The v1.1 backlog lives in ROADMAP.md: real cluster proof, real
  version upgrade, rolling update strategy, admission and
  validation, multi endpoint scope, real cost data, failure
  injection on a real cluster, and observability.
