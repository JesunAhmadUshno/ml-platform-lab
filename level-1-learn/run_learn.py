"""Learn runner: one designed teaching scenario over the simulated cluster.

Scenario, in order (every number below is hand-computed in the tests):
1. Three fleet nodes (simulated capacities, named for the real fleet
   nodes they stand for): node-r610 8000m and 16384 MiB, node-v2 4000m
   and 8192 MiB, node-v3 4000m and 8192 MiB.
2. ConfigMap api-config: MODEL_NAME tiny-gpt, MAX_BATCH 8, LOG_LEVEL info.
3. Deployment api, 3 replicas, 500m and 512 MiB each, labels app api,
   reading api-config. Deployment worker, 2 replicas, 1000m and
   1024 MiB each, labels app worker. Standalone pod debug, 250m and
   256 MiB, labels app debug.
4. Service api-svc, selector app api, port 80 to target port 8080.
   Six requests route round robin over the endpoints.
5. Pod api-1 is deleted. Reconcile creates api-3.
6. Deployment worker scales from 2 to 3 replicas, creating worker-2.
7. Pod huge asks for 16000m and fits nowhere: Pending.
8. ConfigMap api-config MAX_BATCH changes from 8 to 16. Running api
   pods keep their creation-time snapshot. Pod api-0 is deleted and
   reconcile creates api-4, the first api pod carrying MAX_BATCH 16.

Run: python3 run_learn.py writes results_learn.json beside this file.
The scenario is deterministic: two runs produce an identical file.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cluster import Cluster, ConfigMap, Deployment, Node, Service

HERE = os.path.dirname(os.path.abspath(__file__))


def build_scenario():
    c = Cluster()
    c.add_node(Node("node-r610", 8000, 16384))
    c.add_node(Node("node-v2", 4000, 8192))
    c.add_node(Node("node-v3", 4000, 8192))
    c.add_configmap(ConfigMap("api-config", {
        "MODEL_NAME": "tiny-gpt", "MAX_BATCH": "8", "LOG_LEVEL": "info"}))

    c.apply_deployment(Deployment("api", 3, {"app": "api"}, 500, 512,
                                  configmap="api-config"))
    c.apply_deployment(Deployment("worker", 2, {"app": "worker"}, 1000, 1024))
    c.create_pod("debug", {"app": "debug"}, 250, 256)
    c.add_service(Service("api-svc", {"app": "api"}, 80, 8080))

    initial_placement = {name: c.pods[name].node for name in
                         ["api-0", "api-1", "api-2",
                          "worker-0", "worker-1", "debug"]}
    endpoints_initial = c.endpoints("api-svc")
    routing = c.route_requests("api-svc", 6)

    c.delete_pod("api-1")
    usage_after_delete = {n: c.node_usage(n) for n in sorted(c.nodes)}
    created_heal = c.reconcile("api")
    heal_placement = {name: c.pods[name].node for name in created_heal}
    endpoints_after_heal = c.endpoints("api-svc")

    scaled = c.scale("worker", 3)
    scale_placement = {name: c.pods[name].node for name in scaled["created"]}

    huge = c.create_pod("huge", {"app": "huge"}, 16000, 1024)

    c.update_configmap("api-config", "MAX_BATCH", "16")
    stale_before_rollout = sorted(
        p.name for p in c.pods.values()
        if p.owner == "api" and p.status == "Running"
        and p.config.get("MAX_BATCH") == "8")
    c.delete_pod("api-0")
    created_rollout = c.reconcile("api")
    rollout_placement = {name: c.pods[name].node for name in created_rollout}

    pods_final = []
    for name in sorted(c.pods):
        p = c.pods[name]
        pods_final.append({
            "name": p.name, "owner": p.owner, "status": p.status,
            "node": p.node, "cpu_m": p.cpu_m, "mem_mib": p.mem_mib,
            "max_batch": p.config.get("MAX_BATCH"),
            "reason": p.reason,
        })
    running = [p for p in pods_final if p["status"] == "Running"]
    node_usage_final = {n: c.node_usage(n) for n in sorted(c.nodes)}
    api_running = [p for p in running if p["owner"] == "api"]
    results = {
        "project": "P20 ml-platform-lab",
        "level": "Learn",
        "simulated": True,
        "note": ("Teaching simulation on the Muse VM. Node names stand "
                 "for the fleet nodes (BlackBoxV2, BlackBoxV3, Dell "
                 "R610); capacities are teaching values, not measured "
                 "live cluster state."),
        "initial_placement": initial_placement,
        "endpoints_initial": endpoints_initial,
        "routing_6_requests": routing,
        "usage_after_delete_api_1": usage_after_delete,
        "heal_created": created_heal,
        "heal_placement": heal_placement,
        "endpoints_after_heal": endpoints_after_heal,
        "scale_created": scaled["created"],
        "scale_placement": scale_placement,
        "huge_pod": {"status": huge.status, "reason": huge.reason},
        "stale_before_rollout": stale_before_rollout,
        "rollout_created": created_rollout,
        "rollout_placement": rollout_placement,
        "endpoints_final": c.endpoints("api-svc"),
        "pods_final": pods_final,
        "node_usage_final": node_usage_final,
        "summary": {
            "pods_created_total": len(pods_final),
            "pods_running": len(running),
            "pods_pending": len([p for p in pods_final
                                 if p["status"] == "Pending"]),
            "pods_deleted": len([p for p in pods_final
                                 if p["status"] == "Deleted"]),
            "endpoints_final_count": len(c.endpoints("api-svc")),
            "total_running_cpu_m": sum(p["cpu_m"] for p in running),
            "total_running_mem_mib": sum(p["mem_mib"] for p in running),
            "api_pods_stale_max_batch_8": len(
                [p for p in api_running if p["max_batch"] == "8"]),
            "api_pods_fresh_max_batch_16": len(
                [p for p in api_running if p["max_batch"] == "16"]),
            "retries_or_recreates": len(created_heal) + len(created_rollout),
        },
    }
    return results


def main():
    results = build_scenario()
    out = os.path.join(HERE, "results_learn.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, sort_keys=True)
        fh.write("\n")
    s = results["summary"]
    print("initial placement:", results["initial_placement"])
    print("endpoints initial:", results["endpoints_initial"],
          "routing 6:", results["routing_6_requests"])
    print("heal created:", results["heal_created"],
          "at", results["heal_placement"])
    print("scale created:", results["scale_created"],
          "at", results["scale_placement"])
    print("huge pod:", results["huge_pod"])
    print("rollout created:", results["rollout_created"],
          "at", results["rollout_placement"])
    print("summary:", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
