# SPEC: ml-platform-lab (P20)

Phase skill: spec-driven-development (house engineering pipeline).
Status: Wave 0 scaffold spec, from Roadmap v2 text and the v3 decision pack. Scope and acceptance criteria below are the v2 section text, kept as the source of truth until the project's wave opens its own spec pass.

Fleet node: BlackBoxV2, BlackBoxV3, Dell R610 (cluster). Wave: Wave 6.
Hiring evidence: 4 of 5 (Kubernetes in 8/56, top-5 career gap, Mistral depth) [confirmed, fleet and scoring pass 2026-11-04, or the decision pack for P23 to P29].

## Project section text (Roadmap v2, or the v3 candidate text for P23 to P29)

ml-platform-lab: NEW

Subject: ML platform operations: Kubernetes, containers, and GPU scheduling. Evidence: Kubernetes named in 8 of 56 postings; the Mistral ML Platform posting goes to operators, CRDs, Kueue, and Karpenter; register Category 13 holds 50 items and items 621 to 628, 653, 667 name this repo's drills [confirmed].
- Learn: core Kubernetes objects by hand on a local cluster (kind or k3d): pods, deployments, services, config maps. Each object gets a plain-words page: what it is, what breaks without it. The P03 container drill is the entry ticket.
- Build: run real jobs on the cluster: the P19 training job and a P03 serving endpoint, with resource requests set right; GPU scheduling with device requests, node labels, and taints; namespaces and limits for multi-tenancy; one Ray Serve or KServe endpoint beside the plain one (register item 481).
- Deep: a tiny operator: one small CRD and controller that keeps a model endpoint at a declared version; one Kubernetes version upgrade on the drill cluster, logged step by step (register items 628, 667); a cost and failure page (what a small cluster teaches that a cloud console hides).
Fan-out: Book chapter "The Floor The Models Stand On". Paper angle: a GPU scheduling note for small clusters (what Kueue-style fairness does at two-GPU scale). Course module: P20-ml-platform-lab.

## Acceptance criteria (scaffold level)

- Learn closes when the level-1-learn code runs, its README teaches the idea, and a fresh-eyes reader can follow it.
- Build closes when the system runs end to end, tests pass, and one benchmark or result table with method is in the README.
- Deep closes when the Deep scope in the section text is done, the failure modes are written, and the dossier is updated to ship state.
- No level closes on a claim. Evidence only: code, tests, numbers, links.
