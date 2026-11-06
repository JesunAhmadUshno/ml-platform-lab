# ROADMAP: ml-platform-lab (P20), v1.1 backlog

Status: v1.0 shipped 2026-11-05 (Learn, Build, and compressed
Deep DONE). This file names the rest of the v2 Deep scope that
the December compression did not build, so no reader mistakes
the compressed Deep for the full scope. Nothing in this file is
built, and nothing here is claimed as a result.

## v1.1 backlog (named, not built)

1. Real cluster proof: run the operator against a real kind or
   k3d cluster on the fleet nodes (BlackBoxV2, BlackBoxV3, Dell
   R610), with the CRD applied as YAML to a real API server.
2. Real version upgrade: one Kubernetes version upgrade on the
   real drill cluster, logged step by step, replacing the
   simulated upgrade in level-3-deep.
3. Rolling update strategy: replace endpoint pods with an
   availability guard (never below a declared ready count),
   instead of replace in name order only.
4. Admission and validation: a validating path for the CRD
   (version strings, replica bounds, request bounds), beyond the
   in-code object used by the simulation.
5. Multi endpoint operator scope: more than one ModelEndpoint,
   more than one namespace, with conflict and quota interaction
   against the Build namespace quotas.
6. Real cost data: replace the modelled, illustrative cost page
   with measured fleet power and capacity figures, or a real
   cloud bill extract, clearly sourced and dated.
7. Failure injection on a real cluster: pod kills, node drain
   under load, and a tested rollback of a failed upgrade, not
   only the simulated branches proven at v1.0.
8. Observability: controller metrics and a reconcile log shipped
   outside the runner output (events, timing, error counts).

## Order

Items 1 and 2 close the largest v1.0 deduction (simulated only)
and come first. Items 3 to 5 deepen the operator. Items 6 to 8
close the cost and operations gaps. Each item closes only on
evidence: code, tests, numbers, links.
