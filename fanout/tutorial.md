# Tutorial: P20 ml-platform-lab, course module

Module: P20-ml-platform-lab
By Jesun Ahmad Ushno
Date: 2026-11-05
License for this tutorial: CC BY 4.0. Code in the repo: Apache-2.0.

## What you will do

You will clone the ml-platform-lab repo, run all three levels,
run the test suite for each level, and read your own results
against the recorded v1.0 numbers. Every command below was
verified by running it in this fan-out cycle. The project needs
Python 3.11 or 3.12 and uses the standard library only. No
cluster, no container tool, no GPU, and no credential are needed,
because every level is a simulation.

One scope fact governs every step: this is a simulated platform.
Simulated jobs, simulated GPU scheduling, simulated quotas, a
KServe-style endpoint that is a model of KServe, and a simulated
operator. No real cluster is contacted by any command below.

## Step 0: Clone and enter the repo

```text
git clone https://github.com/JesunAhmadUshno/ml-platform-lab.git
cd ml-platform-lab
```

Optional smoke check, before the levels:

```text
python tests/test_smoke.py
```

Expected: scaffold smoke test: PASS, 8 files present.

## Step 1: Level 1, Learn, core objects in a simulated cluster

Read level-1-learn/README.md first.

```text
python level-1-learn/run_learn.py
python tests/test_learn_platform.py
```

Expected: 10 pods created, 7 Running, 1 Pending, 2 Deleted;
final endpoints 3; total running 4750m cpu and 4864 MiB; 2 api
pods stale at MAX_BATCH 8 and 1 fresh at 16; all Learn checks
passed (28 checks). The runner writes
level-1-learn/results_learn.json deterministically.

## Step 2: Level 2, Build, jobs, GPU scheduling, quotas, endpoints

Read level-2-build/README.md and level-2-build/BUILD-SPEC.md.

```text
python level-2-build/run_build.py
python tests/test_build_platform.py
```

Expected: 11 pods admitted, 2 admission rejections; jobs
train-v1 Succeeded in 1 attempt, train-flaky Succeeded in 2
attempts, train-doomed Failed in 2 attempts; 5 attempts, 2
retries, 9 ticks in total; plain and KServe-style endpoints 2
each; final Running 4 pods at 5000m cpu and 10240 MiB; all 39
Build checks passed. The runner writes
level-2-build/results_build.json.

## Step 3: Level 3, Deep, simulated operator and cluster upgrade

Read level-3-deep/README.md and level-3-deep/DEEP-SPEC.md.

```text
python level-3-deep/run_deep.py
python tests/test_deep_platform.py
```

Expected: 4 reconcile passes, 9 actions (4 creates, 4 replaces,
1 delete), version log 1 entry (v1 to v2), final 3 pods all at
v2 at 1500m cpu and 3072 MiB; simulated cluster upgrade 1.29 to
1.30 in 11 steps, 4 pre-checks and 4 post-checks passed, no
rollback; modelled cost 130 USD per month, illustrative only;
all 29 Deep checks passed. The runner writes
level-3-deep/results_deep.json.

## Step 4: Full suite

```text
python tests/test_smoke.py
python tests/test_learn_platform.py
python tests/test_build_platform.py
python tests/test_deep_platform.py
```

Expected: 96 checks in total (28 Learn, 39 Build, 29 Deep), all
passing, plus the scaffold smoke test.

## If your numbers differ

Check the results files (results_learn.json, results_build.json,
results_deep.json) first. The scenarios are deterministic and
carry no wall-clock fields, so every field should match the
recorded v1.0 values on the same code. A difference means the
code changed, not that the cluster behaved differently: there
is no cluster.
