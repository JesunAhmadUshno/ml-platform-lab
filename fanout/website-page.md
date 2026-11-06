# Website project page copy: ml-platform-lab

Site: jesunahmadushno.com
Status: COPY ONLY, draft for the project page. Dated 2026-11-05.
Nothing on any website was changed by this file.

## Headline

ml-platform-lab: ML platform operations taught by a fully simulated platform, labelled simulated everywhere

## Summary

ml-platform-lab is an open ML platform study built by Jesun
Ahmad Ushno as project P20 in Roadmap v3. It simulates the floor
the models stand on: pods, deployments, services, and config
maps; jobs, GPU scheduling, namespace quotas, and a KServe-style
endpoint; and a model endpoint operator with drift healing and a
cluster upgrade drill. It runs on the Python standard library
only.

One scope fact, stated plainly. This is a simulated platform.
No real cluster was contacted at any level: no kubectl, kind,
k3d, or docker was found, nothing was installed, and no real
cluster, container, GPU hardware, operator deployment, or
version upgrade ran.

Status: v1.0, 2026-11-05. Learn, Build, and Deep are done.
Grades on the house 10,000 scale: Learn 8,700, Build 8,500,
Deep 8,200. Total tests: 96 checks, plus the scaffold smoke test.

## Results (all simulated)

| Level | Scenario | Key result | Notes |
| --- | --- | --- | --- |
| Learn | 3 simulated nodes, 10 pods | 7 Running, 1 Pending, 2 Deleted, endpoints 3, 4750m cpu and 4864 MiB running | ConfigMap rollout: 2 stale at MAX_BATCH 8, 1 fresh at 16; 28 checks |
| Build | Jobs, GPU scheduling, quotas, services | 11 admitted, 2 quota rejections, jobs 2 Succeeded and 1 Failed, final Running 4 pods at 5000m cpu and 10240 MiB | Plain and KServe-style services at 2 endpoints each; 39 checks |
| Deep | Simulated operator and upgrade | 4 passes, 9 actions, final 3 pods all at v2, upgrade 1.29 to 1.30 in 11 steps, modelled cost 130 USD per month | Cost modelled and illustrative only; 29 checks |

## Honest limits

- Simulated only: no real cluster proof exists yet.
- The P19 training job and P03 serving endpoint are simulated
  stand-ins, not real workloads.
- The KServe-style object is a model of KServe, not KServe.
- Cost figures use invented unit prices, for teaching only.
- Run on the Muse VM (CPU), not the assigned fleet nodes.

## Links

- GitHub repo: https://github.com/JesunAhmadUshno/ml-platform-lab
- Release v0.1 (Learn): https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.1
- Release v0.5 (Build): https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v0.5
- Release v1.0 (Learn, Build, Deep): https://github.com/JesunAhmadUshno/ml-platform-lab/releases/tag/v1.0
- Tutorial: fanout/tutorial.md in the GitHub repo
- Blog post draft: fanout/blog-post.md in the GitHub repo

## License note

Code: Apache-2.0. Tutorials: CC BY 4.0.
