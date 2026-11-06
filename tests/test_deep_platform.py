"""Deep tests for P20 ml-platform-lab. Every expected value below
was hand-computed from the oracle in level-3-deep/DEEP-SPEC.md
before the runner was executed.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "level-3-deep"))

from deep_operator import ClusterUpgrade, Controller, DrillNode, EndpointPod, ModelEndpoint  # noqa: E402
from run_deep import build_scenario  # noqa: E402

RESULTS = build_scenario()
FAILURES = []
CHECKS = [0]


def check(name, actual, expected):
    CHECKS[0] += 1
    if actual != expected:
        FAILURES.append(name + ": got " + repr(actual) +
                        " want " + repr(expected))
    else:
        print("ok", name)


S = RESULTS["summary"]
check("summary", S, {
    "reconcile_passes": 4, "total_actions": 9, "creates": 4,
    "replaces": 4, "deletes": 1, "version_log_entries": 1,
    "final_declared_version": "v2", "final_pods": 3,
    "final_pods_at_declared": 3, "final_running_cpu_m": 1500,
    "final_running_mem_mib": 3072, "cluster_from_version": "1.29",
    "cluster_to_version": "1.30", "cluster_upgrade_steps": 11,
    "cluster_pre_checks_passed": 4, "cluster_post_checks_passed": 4,
    "rollback_triggered": False,
    "modelled_total_usd_per_month": 130})

check("endpoint spec final", RESULTS["endpoint_spec"], {
    "name": "chat-endpoint", "namespace": "team-serve",
    "model": "tiny-gpt", "declared_version": "v2", "replicas": 3,
    "cpu_req_m": 500, "mem_req_mib": 1024})

check("pass counts", RESULTS["action_counts_by_pass"], {
    "pass1": {"create": 3, "replace": 0, "delete": 0},
    "pass2": {"create": 0, "replace": 0, "delete": 0},
    "pass3": {"create": 0, "replace": 3, "delete": 0},
    "pass4": {"create": 1, "replace": 1, "delete": 1}})

check("pass2 idempotent", RESULTS["pass_actions"]["pass2"], [])

check("state after pass1 versions",
      [(p["name"], p["version"]) for p in RESULTS["state_after_pass1"]],
      [("chat-endpoint-0", "v1"), ("chat-endpoint-1", "v1"),
       ("chat-endpoint-2", "v1")])

check("state after pass3 versions",
      [(p["name"], p["version"]) for p in RESULTS["state_after_pass3"]],
      [("chat-endpoint-0", "v2"), ("chat-endpoint-1", "v2"),
       ("chat-endpoint-2", "v2")])

check("state before pass4 drift",
      [(p["name"], p["version"])
       for p in RESULTS["state_before_pass4"]],
      [("chat-endpoint-0", "v2"), ("chat-endpoint-2", "v1"),
       ("chat-endpoint-99", "v2")])

check("version upgrade log", RESULTS["version_upgrade_log"], [
    {"endpoint": "chat-endpoint", "from_version": "v1",
     "to_version": "v2"}])

check("action log sequence",
      [(a["seq"], a["pass"], a["action"], a["pod"])
       for a in RESULTS["action_log"]],
      [(1, 1, "create", "chat-endpoint-0"),
       (2, 1, "create", "chat-endpoint-1"),
       (3, 1, "create", "chat-endpoint-2"),
       (4, 3, "replace", "chat-endpoint-0"),
       (5, 3, "replace", "chat-endpoint-1"),
       (6, 3, "replace", "chat-endpoint-2"),
       (7, 4, "create", "chat-endpoint-1"),
       (8, 4, "replace", "chat-endpoint-2"),
       (9, 4, "delete", "chat-endpoint-99")])

check("pass4 actions",
      [(a["action"], a["pod"], a["from_version"], a["to_version"])
       for a in RESULTS["pass_actions"]["pass4"]],
      [("create", "chat-endpoint-1", None, "v2"),
       ("replace", "chat-endpoint-2", "v1", "v2"),
       ("delete", "chat-endpoint-99", "v2", None)])

check("final pods", RESULTS["final_pods"], [
    {"name": "chat-endpoint-0", "version": "v2", "status": "Running",
     "cpu_req_m": 500, "mem_req_mib": 1024},
    {"name": "chat-endpoint-1", "version": "v2", "status": "Running",
     "cpu_req_m": 500, "mem_req_mib": 1024},
    {"name": "chat-endpoint-2", "version": "v2", "status": "Running",
     "cpu_req_m": 500, "mem_req_mib": 1024}])

check("endpoint healthy final", RESULTS["endpoint_healthy_final"], True)

UP = RESULTS["cluster_upgrade"]
check("cluster steps", UP["steps"], [
    "pre-checks complete", "backup etcd snapshot (simulated)",
    "upgrade control plane cp-0 from 1.29 to 1.30",
    "upgrade kubelet on cp-0 from 1.29 to 1.30",
    "drain worker-0",
    "upgrade kubelet on worker-0 from 1.29 to 1.30",
    "uncordon worker-0", "drain worker-1",
    "upgrade kubelet on worker-1 from 1.29 to 1.30",
    "uncordon worker-1", "post-checks complete"])
check("cluster pre-checks pass",
      [c["pass"] for c in UP["pre_checks"]], [True, True, True, True])
check("cluster post-checks pass",
      [c["pass"] for c in UP["post_checks"]], [True, True, True, True])
check("cluster final versions",
      [UP["final_control_plane_version"], UP["final_kubelet_versions"]],
      ["1.30", {"cp-0": "1.30", "worker-0": "1.30",
                "worker-1": "1.30"}])
check("cluster status and rollback",
      [UP["status"], UP["rollback_triggered"]], ["Succeeded", False])
check("cluster simulated flag", UP["simulated"], True)

check("cost model totals",
      [RESULTS["cost_model"]["node_cost_usd_per_month"],
       RESULTS["cost_model"]["storage_cost_usd_per_month"],
       RESULTS["cost_model"]["total_modelled_usd_per_month"]],
      [120, 10, 130])

# Isolated: a fresh controller is idempotent after its first pass.
ep2 = ModelEndpoint("solo", "team-serve", "m", "v1", 2, 100, 128)
ctl2 = Controller(ep2)
first = ctl2.reconcile()
second = ctl2.reconcile()
check("isolated first pass creates", len(first), 2)
check("isolated second pass empty", second, [])
check("isolated healthy", ctl2.healthy(), True)

# Isolated: one tampered pod is replaced, the correct pod is kept.
ctl2.pods["solo-1"].version = "v0"
acts = ctl2.reconcile()
check("isolated tamper heal",
      [(a["action"], a["pod"]) for a in acts],
      [("replace", "solo-1")])
check("isolated healed healthy", ctl2.healthy(), True)

# Isolated: a missing pod is recreated and an extra pod is deleted
# in the same pass, in that order.
del ctl2.pods["solo-0"]
ctl2.pods["solo-77"] = EndpointPod("solo-77", "v1", 100, 128)
acts2 = ctl2.reconcile()
check("isolated missing plus extra",
      [(a["action"], a["pod"]) for a in acts2],
      [("create", "solo-0"), ("delete", "solo-77")])

# Isolated: an unhealthy endpoint fails the upgrade pre-check and
# the upgrade reports Failed, which is the rollback trigger state
# described in the rollback note.
nodes = [DrillNode("cp-0", "1.29"), DrillNode("worker-0", "1.29"),
         DrillNode("worker-1", "1.29")]
bad = ClusterUpgrade("1.29", nodes, "1.30", False).run_upgrade()
check("unhealthy endpoint pre-check",
      bad["pre_checks"][3], {"name": "endpoint healthy before upgrade",
                             "pass": False})
check("unhealthy upgrade status", bad["status"], "Failed")

# Determinism and file identity, same pattern as Learn and Build.
check("scenario deterministic", build_scenario(), RESULTS)
path = os.path.join(ROOT, "level-3-deep", "results_deep.json")
with open(path, encoding="utf-8") as fh:
    on_disk = json.load(fh)
check("results file matches fresh build", on_disk, RESULTS)

if FAILURES:
    print("FAILURES:", len(FAILURES))
    for f in FAILURES:
        print(" -", f)
    raise SystemExit(1)
print("all", CHECKS[0], "Deep checks passed")
