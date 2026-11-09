# 0002. Build every level as a simulation when no cluster toolchain existed

Date: 2026-11-05 (recorded 2026-11-08). Status: accepted, to be revisited.

## Context

The scaffold spec asked for a local kind or k3d cluster. On the Muse
VM where the levels were built, the toolchain check found no kubectl,
kind, k3d or docker, and installing them was out of scope for that
cycle (level-2-build/BUILD-SPEC.md, "Honest constraint, checked first").

## Decision

Build the Learn, Build and Deep levels as deterministic,
standard-library simulations, labelled as simulated in every file and
results note, with no claim about any real cluster.

## Consequences

Every result is a designed-scenario output, reproducible byte for byte
but not a measurement. The system under study has never run, so the
verdict stays Draft until a real cluster runs on the fleet nodes
(REPORT.md, v1.1 backlog items 1 and 2). Reversing this decision needs
an Owner call on the cluster setup.
