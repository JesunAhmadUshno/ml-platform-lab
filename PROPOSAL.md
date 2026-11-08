# PROPOSAL: ml-platform-lab (P20)

Status: NOT LOCKED. This repo is not pre-registered. The scaffold spec
below was committed on 2026-11-04 (commit 8b45fb4), before any code or
result, but it states scope and acceptance criteria only: no
hypotheses, no pass lines and no analysis plan. It is therefore not a
pre-registration, and no lock tag is placed on it. Under the portfolio
standard (METHOD section 7) the repo is capped at Functional until a
locked confirmatory cycle lifts the cap; for a systems repo, a timed
drill under a locked proposal qualifies. That cycle is not part of the
standard v2 migration.

Everything below the "Candidate hypotheses" section is moved verbatim
from the files it replaces: SPEC.md, NOVELTY.md and DOSSIER.md (the one
grade sentence in DOSSIER.md is removed; grades are internal). The
level specs stay next to their code as level-2-build/BUILD-SPEC.md and
level-3-deep/DEEP-SPEC.md (docs/decisions/0001). The moved text keeps
the old file names as written; the evidence map in REPORT.md gives each
old file's new home.

## Question

Can a small home fleet run an ML platform on Kubernetes (jobs with GPU
scheduling, namespace quotas, a model endpoint kept at its declared
version by a small operator, and a version upgrade) with every failure
mode written down and each recovery shown?

## Candidate hypotheses for the confirmatory cycle (draft, not locked)

Drawn from the v1.1 backlog already written in this repo (REPORT.md).
Targets, budgets and the number of registered trials are open and
belong to the Owner before the lock. Every trial counts; no retry until
it passes.

- H1, operator on a real cluster: the ModelEndpoint controller, run
  against a real kind or k3d cluster on the fleet nodes, brings the
  endpoint back to its declared replicas and version after each of the
  three registered drifts (deleted pod, tampered pod, extra pod) within
  a recovery target (open).
- H2, version upgrade drill: one real Kubernetes minor-version upgrade
  of the drill cluster completes, timed, with the endpoint never below
  a declared ready count, and a failed pre-check halts the upgrade
  before any node changes (the simulated upgrade does not halt today;
  REPORT.md, Misses).
- H3, placement agreement: the Learn and Build pod sequences replayed
  through the real kube-scheduler place pods where the simulator says,
  or every disagreement is explained by a named simplification
  (agreement threshold: open).

Field-profile requirements the cycle must carry (Systems, reliability):
stated availability, recovery time (RTO) and data-loss window (RPO)
targets; timed drills on the named fleet nodes; monitoring that would
have caught each drill's fault; a runbook a second person can follow;
a postmortem for every incident.

## Scope (scaffold spec, SPEC.md, 2026-11-04)

Phase skill: spec-driven-development (house engineering pipeline).
Status: Wave 0 scaffold spec, from Roadmap v2 text and the v3 decision pack. Scope and acceptance criteria below are the v2 section text, kept as the source of truth until the project's wave opens its own spec pass.

Fleet node: BlackBoxV2, BlackBoxV3, Dell R610 (cluster). Wave: Wave 6.
Hiring evidence: 4 of 5 (Kubernetes in 8/56, top-5 career gap, Mistral depth) [confirmed, fleet and scoring pass 2026-11-04, or the decision pack for P23 to P29].

### Project section text (Roadmap v2, or the v3 candidate text for P23 to P29)

ml-platform-lab: NEW

Subject: ML platform operations: Kubernetes, containers, and GPU scheduling. Evidence: Kubernetes named in 8 of 56 postings; the Mistral ML Platform posting goes to operators, CRDs, Kueue, and Karpenter; register Category 13 holds 50 items and items 621 to 628, 653, 667 name this repo's drills [confirmed].
- Learn: core Kubernetes objects by hand on a local cluster (kind or k3d): pods, deployments, services, config maps. Each object gets a plain-words page: what it is, what breaks without it. The P03 container drill is the entry ticket.
- Build: run real jobs on the cluster: the P19 training job and a P03 serving endpoint, with resource requests set right; GPU scheduling with device requests, node labels, and taints; namespaces and limits for multi-tenancy; one Ray Serve or KServe endpoint beside the plain one (register item 481).
- Deep: a tiny operator: one small CRD and controller that keeps a model endpoint at a declared version; one Kubernetes version upgrade on the drill cluster, logged step by step (register items 628, 667); a cost and failure page (what a small cluster teaches that a cloud console hides).
Fan-out: Book chapter "The Floor The Models Stand On". Paper angle: a GPU scheduling note for small clusters (what Kueue-style fairness does at two-GPU scale). Course module: P20-ml-platform-lab.

### Acceptance criteria (scaffold level)

- Learn closes when the level-1-learn code runs, its README teaches the idea, and a fresh-eyes reader can follow it.
- Build closes when the system runs end to end, tests pass, and one benchmark or result table with method is in the README.
- Deep closes when the Deep scope in the section text is done, the failure modes are written, and the dossier is updated to ship state.
- No level closes on a claim. Evidence only: code, tests, numbers, links.

## Prior work and novelty (NOVELTY.md, draft)

Status: DRAFT, PROPOSED. Not verified. This text does not move into any public post, paper, or profile until the Jev claim_check gate passes on the exact text.

### Proposed claim

Against Kubernetes tutorials and managed ML platform docs: this project aims to differ in the way its SPEC.md section text defines (a from-zero or self-hosted build, measured in public, on a named home fleet, with the failure modes written down). The exact difference is stated at the project's wave, after the prior art is re-read.

### Prior art table

| Prior art | What it does | What this project does differently | Measured difference |
| --- | --- | --- | --- |
| Kubernetes tutorials and managed ML platform docs | See DOSSIER.md, Past | PROPOSED, see the claim above | NO MEASUREMENT YET |

### Honest size

If the novelty proves small, this file will say so and name the real value instead (a cleaner reproduction, a better benchmark, a first public dataset). No novelty is invented to fill this section.

## Dossier: past, present, future (DOSSIER.md)

Written under the documentation and publishing standard (past, present, future). Updated at ship time.

### Past

Prior art for this project is named in NOVELTY.md (Kubernetes tutorials and managed ML platform docs). The history of the problem, the key papers and systems, and what was tried before are recorded in the Roadmap v2 section text in SPEC.md and will be expanded with dated sources at the project's wave, before Build opens.

### Present

Current demand evidence: hiring value 4 of 5 (Kubernetes in 8/56, top-5 career gap, Mistral depth) [confirmed, fleet and scoring pass 2026-11-04; for P23 to P29, the decision pack 2026-11-04]. The Round 3 research (2026-11-04) found the market centre at post-training, evals, environments, and inference depth [confirmed as the research finding; the report is at ~/workspace/research_notes/roadmap-v3-revaluation-research-20261104-0949/report.md]. Tools and versions are pinned at Build time, not in this v1.

### Future

Open problems and the project's next steps sit in the Deep level scope in SPEC.md. Any forecast about this field is [unverified] unless a dated primary source is added here at the wave update.

### Ship state (2026-11-05, v1.0)

Learn DONE, Build DONE, and Deep DONE, all on 2026-11-05 as early Sprint 4 pulls, all stdlib simulations on the Muse VM, labelled as such in every file. No real cluster, container, GPU hardware, operator deployment, or version upgrade was contacted or run at any level; the toolchain check found no kubectl, kind, k3d, or docker on this VM and nothing was installed.

Deep, compressed: a simulated ModelEndpoint CRD and controller keep chat-endpoint (tiny-gpt, 3 replicas) at its declared version over 4 reconcile passes with 9 mutating actions, a version upgrade from v1 to v2 in 1 log entry, and drift healing for a deleted pod, a tampered pod, and an extra pod, ending with 3 pods all at v2. A simulated drill cluster upgrade from 1.29 to 1.30 runs 11 steps with 4 pre-checks and 4 post-checks passing and no rollback. The cost page is modelled and illustrative only (130 USD per month on invented unit prices); no real cost data is claimed. The rest of the v2 Deep scope is the named v1.1 backlog in ROADMAP.md, first items a real cluster proof and a real version upgrade on the fleet nodes.
