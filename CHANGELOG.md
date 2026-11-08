# Changelog

All notable changes to this project. Format: Keep a Changelog 1.1.
Versions follow Semantic Versioning. The tags v0.1, v0.5 and v1.0 mark
the old Learn, Build and Deep levels; they predate the portfolio
standard v2 and are not a "v1.0 Released" verdict under it.

## [Unreleased]

### Changed
- 2026-11-08: Restructured to the portfolio standard v2. README is the
  abstract (verdict: Draft, not pre-registered). PROPOSAL.md (not
  locked) replaces SPEC.md, NOVELTY.md and DOSSIER.md; REPORT.md
  replaces the old README body, docs/research-review.md and ROADMAP.md.
  Grades and rubric scores removed from every public file and the
  dashboard; grades are kept internal. Decision records added in
  docs/decisions/.
- 2026-11-08: CI gains read-only token permissions, a layout and
  no-grade test, pytest collection, and a check that all three results
  files regenerate unchanged. CodeQL covers Python and JavaScript;
  Dependabot watches site/ npm. The dashboard reads PROPOSAL.md,
  REPORT.md and the README verdict.

### Added
- 2026-11-07: Live dashboard in site/ (JavaScript ports of the three
  simulators with a build-time known-answer check), randomized
  invariant tests, the check-count test and the pytest collection fix.
- 2026-11-07: Research review (now in REPORT.md).

## [1.0] - 2026-11-05

### Added
- Level 3 Deep (compressed): simulated ModelEndpoint operator and
  controller, simulated 1.29 to 1.30 cluster upgrade, modelled cost
  page, written failure modes; 29 checks. v1.1 backlog named.
- Actions polish pack (CI matrix, ruff, CodeQL, release, labeler,
  greetings, stale) and the fan-out drafts in fanout/.

## [0.5] - 2026-11-05

### Added
- Level 2 Build: simulated jobs with retries, GPU scheduling with
  nodeSelector and taints, namespace quotas, a KServe-style endpoint;
  39 checks.

## [0.1] - 2026-11-05

### Added
- Level 1 Learn: simulated Pod, Deployment, Service and ConfigMap over
  three nodes with a one-rule scheduler; 28 checks.
- 2026-11-04: Wave 0 scaffold (spec, dossier v1, novelty draft).
