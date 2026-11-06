"""Learn tests for P20 ml-platform-lab. Every expected value below was
hand-computed from the documented scheduling rule (lowest cpu
utilisation among nodes that fit, ties by node name) and the scenario
in run_learn.py, before the runner was executed.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "level-1-learn"))

from cluster import Cluster, ConfigMap, Deployment, Node, Service  # noqa: E402
from run_learn import build_scenario  # noqa: E402

RESULTS = build_scenario()
FAILURES = []


def check(name, actual, expected):
    if actual != expected:
        FAILURES.append(name + ": got " + repr(actual) +
                        " want " + repr(expected))
    else:
        print("ok", name)


def fresh_cluster():
    c = Cluster()
    c.add_node(Node("node-r610", 8000, 16384))
    c.add_node(Node("node-v2", 4000, 8192))
    c.add_node(Node("node-v3", 4000, 8192))
    return c


# Hand computation, scheduling (utilisation before placement):
# api-0: all nodes at 0, tie broken by name -> node-r610 (500 used)
# api-1: node-v2 and node-v3 at 0 -> node-v2 (500 used)
# api-2: node-v3 at 0 -> node-v3 (500 used)
# worker-0 (1000): r610 500/8000 = 0.0625 is lowest -> node-r610 (1500)
# worker-1 (1000): v2 and v3 at 500/4000 = 0.125 -> node-v2 (1500)
# debug (250): v3 at 500/4000 = 0.125 is lowest -> node-v3 (750)
check("initial placement", RESULTS["initial_placement"], {
    "api-0": "node-r610", "api-1": "node-v2", "api-2": "node-v3",
    "worker-0": "node-r610", "worker-1": "node-v2", "debug": "node-v3"})
check("initial endpoints", RESULTS["endpoints_initial"],
      ["api-0", "api-1", "api-2"])
check("routing 6 round robin", RESULTS["routing_6_requests"],
      {"api-0": 2, "api-1": 2, "api-2": 2})

# After deleting api-1, node-v2 holds only worker-1: 1000m, 1024 MiB.
check("usage after delete api-1, node-v2",
      RESULTS["usage_after_delete_api_1"]["node-v2"],
      {"cpu_m": 1000, "mem_mib": 1024, "pods": ["worker-1"]})
# Heal: api-3 utils are r610 1500/8000 = 0.1875, v2 0.25, v3 0.1875,
# tie broken by name -> node-r610.
check("heal created", RESULTS["heal_created"], ["api-3"])
check("heal placement", RESULTS["heal_placement"], {"api-3": "node-r610"})
check("endpoints after heal", RESULTS["endpoints_after_heal"],
      ["api-0", "api-2", "api-3"])

# Scale: worker-2 utils are r610 2000/8000 = 0.25, v2 0.25,
# v3 750/4000 = 0.1875 -> node-v3.
check("scale created", RESULTS["scale_created"], ["worker-2"])
check("scale placement", RESULTS["scale_placement"],
      {"worker-2": "node-v3"})

check("huge pod pending", RESULTS["huge_pod"]["status"], "Pending")
check("huge pod reason", RESULTS["huge_pod"]["reason"],
      "Insufficient cpu or memory on every node")

# Config rollout: all 3 running api pods carry the stale snapshot
# before the rollout; deleting api-0 recreates api-4 on node-r610
# (utils after the delete: r610 1500/8000 = 0.1875 is lowest).
check("stale before rollout", RESULTS["stale_before_rollout"],
      ["api-0", "api-2", "api-3"])
check("rollout created", RESULTS["rollout_created"], ["api-4"])
check("rollout placement", RESULTS["rollout_placement"],
      {"api-4": "node-r610"})
check("endpoints final", RESULTS["endpoints_final"],
      ["api-2", "api-3", "api-4"])

# Final node usage, hand sums:
# r610: worker-0 1000 + api-3 500 + api-4 500 = 2000m;
#       mem 1024 + 512 + 512 = 2048
# v2: worker-1 alone = 1000m, 1024 MiB
# v3: api-2 500 + debug 250 + worker-2 1000 = 1750m;
#     mem 512 + 256 + 1024 = 1792
check("node usage final r610", RESULTS["node_usage_final"]["node-r610"],
      {"cpu_m": 2000, "mem_mib": 2048,
       "pods": ["api-3", "api-4", "worker-0"]})
check("node usage final v2", RESULTS["node_usage_final"]["node-v2"],
      {"cpu_m": 1000, "mem_mib": 1024, "pods": ["worker-1"]})
check("node usage final v3", RESULTS["node_usage_final"]["node-v3"],
      {"cpu_m": 1750, "mem_mib": 1792,
       "pods": ["api-2", "debug", "worker-2"]})

# Summary hand sums: created 6 initial + api-3 + worker-2 + huge
# + api-4 = 10; running 7; pending 1 (huge); deleted 2 (api-0, api-1);
# running cpu 2000 + 1000 + 1750 = 4750; mem 2048 + 1024 + 1792 = 4864.
check("summary", RESULTS["summary"], {
    "pods_created_total": 10, "pods_running": 7, "pods_pending": 1,
    "pods_deleted": 2, "endpoints_final_count": 3,
    "total_running_cpu_m": 4750, "total_running_mem_mib": 4864,
    "api_pods_stale_max_batch_8": 2, "api_pods_fresh_max_batch_16": 1,
    "retries_or_recreates": 2})

# ConfigMap snapshot semantics, isolated cluster.
c2 = fresh_cluster()
c2.add_configmap(ConfigMap("cfg", {"K": "1"}))
c2.apply_deployment(Deployment("d", 1, {"app": "d"}, 100, 128,
                               configmap="cfg"))
check("snapshot at creation", c2.pods["d-0"].config["K"], "1")
c2.update_configmap("cfg", "K", "2")
check("running pod keeps old snapshot", c2.pods["d-0"].config["K"], "1")
c2.delete_pod("d-0")
c2.reconcile("d")
check("recreated pod gets new snapshot", c2.pods["d-1"].config["K"], "2")
check("recreated pod name counter", sorted(
    n for n, p in c2.pods.items() if p.status == "Running"), ["d-1"])

# Service selector matches labels, not names: worker pods never appear.
c3 = fresh_cluster()
c3.apply_deployment(Deployment("api", 2, {"app": "api"}, 500, 512))
c3.apply_deployment(Deployment("worker", 1, {"app": "worker"}, 500, 512))
c3.add_service(Service("s", {"app": "api"}, 80, 8080))
check("selector excludes worker", c3.endpoints("s"), ["api-0", "api-1"])
check("routing with no endpoints", c3.route_requests("s", 0), 
      {"api-0": 0, "api-1": 0})

# Deleting a pod frees its node resources.
before = c3.node_usage(c3.pods["api-0"].node)["cpu_m"]
c3.delete_pod("api-0")
after = c3.node_usage("node-r610")["cpu_m"]
check("delete frees cpu", before - after, 500)

# Determinism: a second full scenario build equals the first, and the
# committed results file equals a fresh build.
check("scenario deterministic", build_scenario(), RESULTS)
path = os.path.join(ROOT, "level-1-learn", "results_learn.json")
with open(path, encoding="utf-8") as fh:
    on_disk = json.load(fh)
check("results file matches fresh build", on_disk, RESULTS)

if FAILURES:
    print("FAILURES:", len(FAILURES))
    for f in FAILURES:
        print(" -", f)
    raise SystemExit(1)
print("all Learn checks passed")
