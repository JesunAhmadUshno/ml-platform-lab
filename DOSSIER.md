# DOSSIER: ml-platform-lab (P20) v1, 2026-11-04

Written under the documentation and publishing standard (past, present, future). Updated at ship time.

## Past

Prior art for this project is named in NOVELTY.md (Kubernetes tutorials and managed ML platform docs). The history of the problem, the key papers and systems, and what was tried before are recorded in the Roadmap v2 section text in SPEC.md and will be expanded with dated sources at the project's wave, before Build opens.

## Present

Current demand evidence: hiring value 4 of 5 (Kubernetes in 8/56, top-5 career gap, Mistral depth) [confirmed, fleet and scoring pass 2026-11-04; for P23 to P29, the decision pack 2026-11-04]. The Round 3 research (2026-11-04) found the market centre at post-training, evals, environments, and inference depth [confirmed as the research finding; the report is at ~/workspace/research_notes/roadmap-v3-revaluation-research-20261104-0949/report.md]. Tools and versions are pinned at Build time, not in this v1.

## Future

Open problems and the project's next steps sit in the Deep level scope in SPEC.md. Any forecast about this field is [unverified] unless a dated primary source is added here at the wave update.

## Ship state (2026-11-05, v1.0)

Learn DONE, Build DONE, and Deep DONE, all on 2026-11-05 as early Sprint 4 pulls, all stdlib simulations on the Muse VM, labelled as such in every file. No real cluster, container, GPU hardware, operator deployment, or version upgrade was contacted or run at any level; the toolchain check found no kubectl, kind, k3d, or docker on this VM and nothing was installed.

Deep, compressed: a simulated ModelEndpoint CRD and controller keep chat-endpoint (tiny-gpt, 3 replicas) at its declared version over 4 reconcile passes with 9 mutating actions, a version upgrade from v1 to v2 in 1 log entry, and drift healing for a deleted pod, a tampered pod, and an extra pod, ending with 3 pods all at v2. A simulated drill cluster upgrade from 1.29 to 1.30 runs 11 steps with 4 pre-checks and 4 post-checks passing and no rollback. The cost page is modelled and illustrative only (130 USD per month on invented unit prices); no real cost data is claimed. Deep grade 8,200 of 10,000 with itemized deductions in level-3-deep/README.md. The rest of the v2 Deep scope is the named v1.1 backlog in ROADMAP.md, first items a real cluster proof and a real version upgrade on the fleet nodes.
