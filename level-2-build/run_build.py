"""Build runner: one designed scenario over the simulated platform.

Simulated and labelled as such: no real cluster, container, or GPU
is contacted. The scenario is defined in BUILD-SPEC.md and every
number is hand-computed in tests/test_build_platform.py.

Order:
1. Four nodes: two CPU nodes (no taints) and two GPU nodes
   (accelerator nvidia-t4 labels, gpu=true NoSchedule taints,
   2 and 1 GPU devices).
2. Three namespaces with quotas: team-train, team-serve,
   team-sandbox.
3. Three training jobs submit first-attempt pods: train-v1
   (1 GPU, succeeds), train-flaky (1 GPU, fails attempt 1),
   train-doomed (no GPU, always fails).
4. Plain serving deployment (2 replicas) and a KServe-style
   InferenceService (2 predictor replicas) in team-serve.
5. Probes: a third team-train GPU job (quota rejection), a sandbox
   GPU pod (quota rejection), gpu-curious (GPU selector, no
   toleration, Pending), train-huge (16000m, Pending).
6. Jobs execute sequentially in submission order.
7. Ten requests route over each serving endpoint set.

Run: python3 run_build.py writes results_build.json beside this
file. Deterministic: no wall-clock fields, two runs are identical.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from platform import Cluster, InferenceService, Job, Namespace, Node, Pod, Service, Taint, Toleration

HERE = os.path.dirname(os.path.abspath(__file__))
GPU_TOLERATION = [Toleration("gpu", "NoSchedule")]
GPU_SELECTOR = {"accelerator": "nvidia-t4"}


def build_scenario():
    c = Cluster()
    gpu_taint = Taint("gpu", "true", "NoSchedule")
    c.add_node(Node("node-cpu-a", 8000, 16384, gpu=0,
                    labels={"zone": "cpu", "pool": "general"}))
    c.add_node(Node("node-cpu-b", 8000, 16384, gpu=0,
                    labels={"zone": "cpu", "pool": "general"}))
    c.add_node(Node("node-gpu-a", 8000, 16384, gpu=2,
                    labels={"accelerator": "nvidia-t4", "pool": "gpu"},
                    taints=[gpu_taint]))
    c.add_node(Node("node-gpu-b", 8000, 16384, gpu=1,
                    labels={"accelerator": "nvidia-t4", "pool": "gpu"},
                    taints=[gpu_taint]))

    c.add_namespace(Namespace("team-train", 24000, 49152, 2, 10))
    c.add_namespace(Namespace("team-serve", 8000, 16384, 1, 6))
    c.add_namespace(Namespace("team-sandbox", 2000, 4096, 0, 3))

    jobs = [
        Job("train-v1", "team-train", {"app": "train-v1"},
            4000, 6000, 8192, 12288, gpu=1,
            node_selector=GPU_SELECTOR, tolerations=GPU_TOLERATION,
            ticks_needed=3, fail_attempts=0, max_retries=0),
        Job("train-flaky", "team-train", {"app": "train-flaky"},
            2000, 3000, 4096, 6144, gpu=1,
            node_selector=GPU_SELECTOR, tolerations=GPU_TOLERATION,
            ticks_needed=2, fail_attempts=1, max_retries=2),
        Job("train-doomed", "team-train", {"app": "train-doomed"},
            1000, 1500, 2048, 3072, gpu=0,
            ticks_needed=1, fail_attempts=99, max_retries=1),
    ]
    for job in jobs:
        c.admit(job.pod_for_attempt(0))
    first_attempt_placement = {
        job.name: c.pods[job.name + "-0"].node for job in jobs}

    plain_pods = []
    for i in range(2):
        pod = c.admit(Pod("serve-plain-" + str(i), "team-serve",
                          {"app": "serve-plain"}, 1000, 1500,
                          2048, 3072, owner="serve-plain",
                          kind="serving"))
        plain_pods.append(pod.name)
    c.add_service(Service("serve-plain-svc", "team-serve",
                          {"app": "serve-plain"}, 80, 8080,
                          kind="plain"))

    isvc = InferenceService(
        "serve-kserve", "team-serve", "tiny-gpt",
        "s3://simulated-bucket/models/tiny-gpt (simulated string, "
        "nothing downloaded)",
        {"app": "serve-kserve"}, 1500, 2000, 3072, 4096,
        replicas=2, min_replicas=1, max_replicas=3,
        target_metric="concurrency 10 per predictor (declared only)")
    kserve_pods = c.apply_inference_service(isvc)

    placement_before_probes = {
        name: c.pods[name].node
        for name in plain_pods + kserve_pods}

    blocked = Job("train-gpu-blocked", "team-train",
                  {"app": "train-gpu-blocked"}, 1000, 1500, 2048, 3072,
                  gpu=1, node_selector=GPU_SELECTOR,
                  tolerations=GPU_TOLERATION, ticks_needed=1)
    c.admit(blocked.pod_for_attempt(0))
    c.admit(Pod("sandbox-gpu", "team-sandbox", {"app": "sandbox-gpu"},
                500, 750, 512, 768, gpu=1, node_selector=GPU_SELECTOR,
                tolerations=GPU_TOLERATION, kind="pod"))
    curious = c.admit(Pod("gpu-curious", "team-serve",
                          {"app": "gpu-curious"}, 500, 750, 512, 768,
                          gpu=0, node_selector=GPU_SELECTOR,
                          kind="pod"))
    huge = c.admit(Pod("train-huge", "team-train",
                       {"app": "train-huge"}, 16000, 16000, 1024, 1024,
                       gpu=0, tolerations=GPU_TOLERATION, kind="pod"))

    quota_at_admission = {
        ns: c.quota_usage(ns) for ns in sorted(c.namespaces)}
    probes = {
        "gpu_curious": {"status": curious.status,
                        "reason": curious.reason},
        "train_huge": {"status": huge.status, "reason": huge.reason},
    }

    for job in jobs:
        c.run_job(job)
    job_records = [c.job_record(job) for job in jobs]

    plain_routing = c.route_requests("serve-plain-svc", 10)
    kserve_routing = c.route_requests("serve-kserve-svc", 10)

    pods_final = []
    for name in sorted(c.pods):
        p = c.pods[name]
        pods_final.append({
            "name": p.name, "namespace": p.namespace,
            "kind": p.kind, "owner": p.owner, "status": p.status,
            "node": p.node, "cpu_req_m": p.cpu_req_m,
            "cpu_lim_m": p.cpu_lim_m, "mem_req_mib": p.mem_req_mib,
            "mem_lim_mib": p.mem_lim_mib, "gpu": p.gpu,
            "reason": p.reason,
        })
    running = [p for p in pods_final if p["status"] == "Running"]
    node_usage_final = {n: c.node_usage(n) for n in sorted(c.nodes)}
    namespace_running = {}
    for ns in sorted(c.namespaces):
        run_ns = [p for p in running if p["namespace"] == ns]
        namespace_running[ns] = {
            "cpu_m": sum(p["cpu_req_m"] for p in run_ns),
            "mem_mib": sum(p["mem_req_mib"] for p in run_ns),
            "gpu": sum(p["gpu"] for p in run_ns),
            "pods": len(run_ns),
        }
    gpu_pods = [p for p in pods_final
                if p["gpu"] > 0 and p["node"] is not None]
    comparison = {
        "plain_service": {
            "backing_object": "Service serve-plain-svc",
            "model_declared": False,
            "storage_uri_declared": False,
            "autoscaling_bounds_declared": False,
            "endpoints": c.endpoints("serve-plain-svc"),
            "requests_routed_10": plain_routing,
        },
        "kserve_style": {
            "backing_object": "InferenceService serve-kserve",
            "model_declared": True,
            "storage_uri_declared": True,
            "autoscaling_bounds_declared": True,
            "endpoints": c.endpoints("serve-kserve-svc"),
            "requests_routed_10": kserve_routing,
            "spec": isvc.spec_dict(),
        },
    }
    results = {
        "project": "P20 ml-platform-lab",
        "level": "Build",
        "simulated": True,
        "note": ("Build-level simulation on the Muse VM. No real "
                 "kind, k3d, or cloud cluster, no containers, and "
                 "no GPU hardware were contacted or run. Node "
                 "names and capacities are teaching values standing "
                 "for fleet CPU and GPU pool roles, not measured "
                 "live cluster state. The training job stands for "
                 "the P19 training job and the plain serving "
                 "endpoint stands for the P03 serving endpoint, as "
                 "SPEC.md Build names them."),
        "first_attempt_placement": first_attempt_placement,
        "serving_placement": placement_before_probes,
        "quota_at_admission": quota_at_admission,
        "rejections": c.rejections,
        "probes": probes,
        "jobs": job_records,
        "serving_comparison": comparison,
        "pods_final": pods_final,
        "node_usage_final": node_usage_final,
        "namespace_running_final": namespace_running,
        "summary": {
            "pods_admitted": len(pods_final),
            "pods_running": len(running),
            "pods_succeeded": len([p for p in pods_final
                                   if p["status"] == "Succeeded"]),
            "pods_failed": len([p for p in pods_final
                                if p["status"] == "Failed"]),
            "pods_pending": len([p for p in pods_final
                                 if p["status"] == "Pending"]),
            "admission_rejected": len(c.rejections),
            "jobs_succeeded": len([j for j in job_records
                                   if j["status"] == "Succeeded"]),
            "jobs_failed": len([j for j in job_records
                                if j["status"] == "Failed"]),
            "jobs_total_attempts": sum(j["attempts"]
                                       for j in job_records),
            "jobs_total_retries": sum(j["retries"]
                                      for j in job_records),
            "jobs_ticks_total": sum(j["ticks_total"]
                                    for j in job_records),
            "gpu_pods_placed": len(gpu_pods),
            "gpu_nodes_used": sorted({p["node"] for p in gpu_pods}),
            "plain_endpoints": len(c.endpoints("serve-plain-svc")),
            "kserve_endpoints": len(c.endpoints("serve-kserve-svc")),
            "total_running_cpu_m": sum(p["cpu_req_m"] for p in running),
            "total_running_mem_mib": sum(p["mem_req_mib"]
                                         for p in running),
        },
    }
    return results


def main():
    results = build_scenario()
    out = os.path.join(HERE, "results_build.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, sort_keys=True)
        fh.write("\n")
    print("first attempt placement:", results["first_attempt_placement"])
    print("serving placement:", results["serving_placement"])
    print("rejections:", results["rejections"])
    print("probes:", results["probes"])
    print("jobs:", [(j["name"], j["status"], j["attempts"],
                     j["retries"]) for j in results["jobs"]])
    print("summary:", results["summary"])
    print("wrote", out)


if __name__ == "__main__":
    main()
