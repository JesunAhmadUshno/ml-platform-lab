"""Build tests for P20 ml-platform-lab. Every expected value below
was hand-computed from the rules in level-2-build/BUILD-SPEC.md
(lowest cpu utilisation among candidate nodes, ties by node name;
quota over active pods; jobs run sequentially in submission order)
before the runner was executed.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "level-2-build"))

from platform import Cluster, InferenceService, Job, Namespace, Node, Pod, Service, Taint, Toleration  # noqa: E402

from run_build import build_scenario  # noqa: E402

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


GPU_TOL = [Toleration("gpu", "NoSchedule")]
GPU_SEL = {"accelerator": "nvidia-t4"}


def fresh_cluster():
    c = Cluster()
    taint = Taint("gpu", "true", "NoSchedule")
    c.add_node(Node("node-cpu-a", 8000, 16384, gpu=0,
                    labels={"zone": "cpu", "pool": "general"}))
    c.add_node(Node("node-cpu-b", 8000, 16384, gpu=0,
                    labels={"zone": "cpu", "pool": "general"}))
    c.add_node(Node("node-gpu-a", 8000, 16384, gpu=2,
                    labels={"accelerator": "nvidia-t4", "pool": "gpu"},
                    taints=[taint]))
    c.add_node(Node("node-gpu-b", 8000, 16384, gpu=1,
                    labels={"accelerator": "nvidia-t4", "pool": "gpu"},
                    taints=[taint]))
    c.add_namespace(Namespace("team-train", 24000, 49152, 2, 10))
    c.add_namespace(Namespace("team-serve", 8000, 16384, 1, 6))
    c.add_namespace(Namespace("team-sandbox", 2000, 4096, 0, 3))
    return c


# Hand computation, first attempts:
# train-v1-0 (gpu): both gpu nodes at utilisation 0, tie by name
#   -> node-gpu-a. train-flaky-0: gpu-a at 4000/8000 = 0.5, gpu-b
#   at 0 -> node-gpu-b. train-doomed-0 (no selector, no toleration):
#   gpu nodes tainted out, cpu nodes tie at 0 -> node-cpu-a.
check("first attempt placement", RESULTS["first_attempt_placement"], {
    "train-v1": "node-gpu-a", "train-flaky": "node-gpu-b",
    "train-doomed": "node-cpu-a"})

# Serving: serve-plain-0: cpu-a at 1000/8000 = 0.125 (doomed),
# cpu-b at 0 -> cpu-b. serve-plain-1: tie 0.125 -> cpu-a.
# predictor-0 (1500): cpu-a 2000/8000 = 0.25, cpu-b 0.125 -> cpu-b.
# predictor-1: cpu-a 0.25, cpu-b 2500/8000 = 0.3125 -> cpu-a.
check("serving placement", RESULTS["serving_placement"], {
    "serve-plain-0": "node-cpu-b", "serve-plain-1": "node-cpu-a",
    "serve-kserve-predictor-0": "node-cpu-b",
    "serve-kserve-predictor-1": "node-cpu-a"})

check("rejections", RESULTS["rejections"], [
    {"pod": "train-gpu-blocked-0", "namespace": "team-train",
     "reason": "QuotaExceeded: gpu in namespace team-train: "
               "used 2 + requested 1 > quota 2"},
    {"pod": "sandbox-gpu", "namespace": "team-sandbox",
     "reason": "QuotaExceeded: gpu in namespace team-sandbox: "
               "used 0 + requested 1 > quota 0"}])

check("gpu-curious probe", RESULTS["probes"]["gpu_curious"], {
    "status": "Pending",
    "reason": "Unschedulable: nodeSelector mismatch; "
              "taint gpu=true:NoSchedule not tolerated"})
check("train-huge probe", RESULTS["probes"]["train_huge"], {
    "status": "Pending",
    "reason": "Unschedulable: Insufficient cpu or memory or gpu"})

# Quota at admission (active pods only): team-train jobs 7000m plus
# train-huge 16000m = 23000m, gpu 2, pods 4 (3 jobs plus huge; the
# blocked job was rejected and never counts). team-serve serving
# 5000m plus gpu-curious 500m = 5500m, mem 10240 + 512 = 10752,
# pods 5. Sandbox rejected its only pod: all zero.
check("quota at admission", RESULTS["quota_at_admission"], {
    "team-sandbox": {"cpu_m": 0, "mem_mib": 0, "gpu": 0, "pods": 0},
    "team-serve": {"cpu_m": 5500, "mem_mib": 10752, "gpu": 0,
                   "pods": 5},
    "team-train": {"cpu_m": 23000, "mem_mib": 15360, "gpu": 2,
                   "pods": 4}})

# Jobs execute in order. train-v1 succeeds in 1 attempt, 3 ticks.
# train-flaky: attempt 1 on node-gpu-b fails (2 ticks), retry pod is
# scheduled after train-v1 freed node-gpu-a and the failed attempt
# freed node-gpu-b, tie at 0 -> node-gpu-a, succeeds (2 more ticks).
# train-doomed: attempt 1 on node-cpu-a fails, retry sees cpu-a and
# cpu-b both holding 2500m of serving (utilisation 0.3125), tie ->
# node-cpu-a, fails again, retries exhausted at 1.
jobs = {j["name"]: j for j in RESULTS["jobs"]}
check("train-v1 job", jobs["train-v1"], {
    "name": "train-v1", "namespace": "team-train",
    "status": "Succeeded", "attempts": 1, "retries": 0,
    "ticks_total": 3, "pod_names": ["train-v1-0"],
    "cpu_req_m": 4000, "mem_req_mib": 8192, "gpu": 1})
check("train-flaky job", jobs["train-flaky"], {
    "name": "train-flaky", "namespace": "team-train",
    "status": "Succeeded", "attempts": 2, "retries": 1,
    "ticks_total": 4,
    "pod_names": ["train-flaky-0", "train-flaky-1"],
    "cpu_req_m": 2000, "mem_req_mib": 4096, "gpu": 1})
check("train-doomed job", jobs["train-doomed"], {
    "name": "train-doomed", "namespace": "team-train",
    "status": "Failed", "attempts": 2, "retries": 1,
    "ticks_total": 2,
    "pod_names": ["train-doomed-0", "train-doomed-1"],
    "cpu_req_m": 1000, "mem_req_mib": 2048, "gpu": 0})
pods = {p["name"]: p for p in RESULTS["pods_final"]}
check("flaky retry placement", pods["train-flaky-1"]["node"],
      "node-gpu-a")
check("flaky retry status", pods["train-flaky-1"]["status"],
      "Succeeded")
check("doomed retry placement", pods["train-doomed-1"]["node"],
      "node-cpu-a")
check("doomed attempt pods failed",
      [pods["train-doomed-0"]["status"],
       pods["train-doomed-1"]["status"]], ["Failed", "Failed"])

# Serving comparison: both endpoint sets route 10 requests at 5 per
# endpoint. Only the KServe side declares model, storage, and
# autoscaling bounds.
comp = RESULTS["serving_comparison"]
check("plain endpoints", comp["plain_service"]["endpoints"],
      ["serve-plain-0", "serve-plain-1"])
check("plain routing 10", comp["plain_service"]["requests_routed_10"],
      {"serve-plain-0": 5, "serve-plain-1": 5})
check("plain declares nothing",
      [comp["plain_service"]["model_declared"],
       comp["plain_service"]["storage_uri_declared"],
       comp["plain_service"]["autoscaling_bounds_declared"]],
      [False, False, False])
check("kserve endpoints", comp["kserve_style"]["endpoints"],
      ["serve-kserve-predictor-0", "serve-kserve-predictor-1"])
check("kserve routing 10", comp["kserve_style"]["requests_routed_10"],
      {"serve-kserve-predictor-0": 5, "serve-kserve-predictor-1": 5})
check("kserve declares model and bounds",
      [comp["kserve_style"]["model_declared"],
       comp["kserve_style"]["storage_uri_declared"],
       comp["kserve_style"]["autoscaling_bounds_declared"]],
      [True, True, True])
check("kserve spec model", comp["kserve_style"]["spec"]["model_name"],
      "tiny-gpt")
check("kserve spec replicas",
      [comp["kserve_style"]["spec"]["predictor_replicas"],
       comp["kserve_style"]["spec"]["min_replicas"],
       comp["kserve_style"]["spec"]["max_replicas"]], [2, 1, 3])

# Final state hand sums: admitted 5 job pods + 4 serving + curious
# + huge = 11. Running 4 (serving only; jobs are terminal, terminal
# pods free their nodes). Succeeded 2, Failed 3, Pending 2.
check("summary", RESULTS["summary"], {
    "pods_admitted": 11, "pods_running": 4, "pods_succeeded": 2,
    "pods_failed": 3, "pods_pending": 2, "admission_rejected": 2,
    "jobs_succeeded": 2, "jobs_failed": 1, "jobs_total_attempts": 5,
    "jobs_total_retries": 2, "jobs_ticks_total": 9,
    "gpu_pods_placed": 3,
    "gpu_nodes_used": ["node-gpu-a", "node-gpu-b"],
    "plain_endpoints": 2, "kserve_endpoints": 2,
    "total_running_cpu_m": 5000, "total_running_mem_mib": 10240})
check("node usage final cpu-a", RESULTS["node_usage_final"]["node-cpu-a"],
      {"cpu_m": 2500, "mem_mib": 5120, "gpu": 0,
       "pods": ["serve-kserve-predictor-1", "serve-plain-1"]})
check("node usage final gpu-a", RESULTS["node_usage_final"]["node-gpu-a"],
      {"cpu_m": 0, "mem_mib": 0, "gpu": 0, "pods": []})
check("namespace running final", RESULTS["namespace_running_final"], {
    "team-sandbox": {"cpu_m": 0, "mem_mib": 0, "gpu": 0, "pods": 0},
    "team-serve": {"cpu_m": 5000, "mem_mib": 10240, "gpu": 0,
                   "pods": 4},
    "team-train": {"cpu_m": 0, "mem_mib": 0, "gpu": 0, "pods": 0}})

# Isolated: a limit below its request is rejected at admission.
c2 = fresh_cluster()
bad = c2.admit(Pod("bad", "team-serve", {"app": "x"}, 1000, 500,
                   512, 512))
check("limit below request rejected", bad, None)
check("limit rejection reason", c2.rejections[-1]["reason"],
      "cpu limit below request")

# Isolated: taint alone blocks a GPU-selector pod with no toleration,
# and a toleration plus a free device places it.
c3 = fresh_cluster()
no_tol = c3.admit(Pod("no-tol", "team-serve", {"app": "g"}, 500, 500,
                      512, 512, gpu=1, node_selector=GPU_SEL))
check("taint blocks without toleration", no_tol.status, "Pending")
with_tol = c3.admit(Pod("with-tol", "team-train", {"app": "g"}, 500,
                        500, 512, 512, gpu=1, node_selector=GPU_SEL,
                        tolerations=GPU_TOL))
check("toleration places on gpu-a", with_tol.node, "node-gpu-a")

# Isolated: GPU device capacity, in a namespace whose GPU quota
# (10) stays above the cluster device total (3), so only device
# counts bind. Placements by the utilisation rule: g0 tie at 0 ->
# gpu-a (1 of 2 used); g1: gpu-a 100/8000, gpu-b 0 -> gpu-b
# (1 of 1 used, now full); g2 -> gpu-a (2 of 2, now full); g3 fits
# no GPU node and stays Pending.
c4 = fresh_cluster()
c4.add_namespace(Namespace("team-gpu", 24000, 49152, 10, 10))
placed = []
for i in range(4):
    p = c4.admit(Pod("g" + str(i), "team-gpu", {"app": "g"}, 100,
                     100, 128, 128, gpu=1, node_selector=GPU_SEL,
                     tolerations=GPU_TOL))
    placed.append(p.node)
check("gpu device spread and exhaustion", placed,
      ["node-gpu-a", "node-gpu-b", "node-gpu-a", None])
check("gpu exhausted pod pending", c4.pods["g3"].status, "Pending")

# Isolated: namespace cpu quota rejects the pod that crosses it.
c5 = fresh_cluster()
c5.admit(Pod("big-1", "team-sandbox", {"app": "b"}, 1500, 1500,
             1024, 1024))
over = c5.admit(Pod("big-2", "team-sandbox", {"app": "b"}, 1000,
                    1000, 1024, 1024))
check("cpu quota rejects", over, None)
check("cpu quota reason", c5.rejections[-1]["reason"],
      "QuotaExceeded: cpu_m in namespace team-sandbox: "
      "used 1500 + requested 1000 > quota 2000")

# Isolated: a job with max_retries 0 fails once and stops.
c6 = fresh_cluster()
job = Job("once", "team-train", {"app": "once"}, 100, 100, 128, 128,
          ticks_needed=1, fail_attempts=1, max_retries=0)
c6.admit(job.pod_for_attempt(0))
c6.run_job(job)
check("no-retry job fails in one attempt",
      [job.status, job.attempts, job.retries], ["Failed", 1, 0])

# Isolated: endpoints respect namespace. A same-label pod in another
# namespace never joins the service.
c7 = fresh_cluster()
c7.admit(Pod("in-ns", "team-serve", {"app": "s"}, 100, 100, 128, 128))
c7.admit(Pod("other-ns", "team-train", {"app": "s"}, 100, 100,
             128, 128))
c7.add_service(Service("s", "team-serve", {"app": "s"}, 80, 8080))
check("endpoints respect namespace", c7.endpoints("s"), ["in-ns"])

# Isolated: InferenceService in a fresh cluster creates its service
# with the kserve kind label and predictor endpoints.
c8 = fresh_cluster()
isvc = InferenceService("m", "team-serve", "model-x",
                        "s3://simulated/x", {"app": "m"}, 100, 100,
                        128, 128, replicas=1, min_replicas=1,
                        max_replicas=2, target_metric="declared")
c8.apply_inference_service(isvc)
check("isvc endpoints", c8.endpoints("m-svc"), ["m-predictor-0"])
check("isvc service kind", c8.services["m-svc"].kind, "kserve")

# Determinism and file identity, same as Learn.
check("scenario deterministic", build_scenario(), RESULTS)
path = os.path.join(ROOT, "level-2-build", "results_build.json")
with open(path, encoding="utf-8") as fh:
    on_disk = json.load(fh)
check("results file matches fresh build", on_disk, RESULTS)

if FAILURES:
    print("FAILURES:", len(FAILURES))
    for f in FAILURES:
        print(" -", f)
    raise SystemExit(1)
print("all", CHECKS[0], "Build checks passed")
