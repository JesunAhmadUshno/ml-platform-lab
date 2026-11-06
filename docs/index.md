# ml-platform-lab

An ML platform operations study built entirely as a simulation: simulated jobs, GPU scheduling, namespace quotas, a KServe-style endpoint, and a simulated model endpoint operator. No real cluster was contacted at any level: no kubectl, kind, k3d, or docker was found on the Muse VM, nothing was installed, and no real cluster, container, GPU hardware, operator deployment, or version upgrade ran. Every number below is a simulated scenario result, labelled as such.

- Learn: simulated core Kubernetes objects over 3 simulated fleet nodes. 10 pods created, 7 Running, 1 Pending, 2 Deleted; final endpoints 3; total running requests 4750m cpu and 4864 MiB; ConfigMap rollout leaves 2 api pods stale at MAX_BATCH 8 and 1 fresh at 16. 28 checks. Grade 8,700 of 10,000.
- Build: simulated ML platform. 11 pods admitted, 2 quota rejections; 3 jobs finish 2 Succeeded and 1 Failed over 5 attempts, 2 retries, 9 ticks; GPU pods placed on both GPU nodes; plain and KServe-style services at 2 endpoints each routing 10 requests at 5 per endpoint; final Running 4 pods at 5000m cpu and 10240 MiB. 39 checks. Grade 8,500 of 10,000.
- Deep: simulated operator. One ModelEndpoint (chat-endpoint, tiny-gpt, 3 replicas) kept at its declared version over 4 reconcile passes with 9 actions (4 creates, 4 replaces, 1 delete); version upgrade v1 to v2 in 1 log entry; drift healing recreates a deleted pod, replaces a tampered pod, deletes an extra pod; final 3 pods all at v2 at 1500m cpu and 3072 MiB; simulated cluster upgrade 1.29 to 1.30 in 11 steps, 4 pre-checks and 4 post-checks pass, no rollback; modelled illustrative cost 130 USD per month. 29 checks. Grade 8,200 of 10,000.

Tests: 96 checks in total (28 Learn, 39 Build, 29 Deep), plus the scaffold smoke test.

Grades on record (of 10,000): Learn 8,700, Build 8,500, Deep 8,200.

Every number above is already published in this repo (README.md, DOSSIER.md, and the three level READMEs and results files) and reproduced by the runners in this repo, checked in CI. The v1.1 backlog in ROADMAP.md names the real cluster proof and the real version upgrade that would replace these simulations.

Releases: https://github.com/JesunAhmadUshno/ml-platform-lab/releases
