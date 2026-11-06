"""A simulated ML platform cluster at Build level, stdlib only.

This is a simulation, not a real cluster. No kind, k3d, kubectl, or
cloud cluster is contacted, and no container or GPU hardware runs.
The model extends the Learn simulation with the Build scope from
SPEC.md: job lifecycles with retries, resource requests and limits,
GPU scheduling with device requests, node labels, taints and
tolerations, namespaces with resource quotas for multi-tenancy, and
a KServe-style InferenceService beside a plain Service endpoint.

Rules, all deterministic (see BUILD-SPEC.md):
- Admission validates limits (a limit below its request is rejected)
  and the namespace resource quota over active pods (Running or
  Pending). A rejected pod is never registered; the rejection names
  the binding resource.
- The scheduler places a pod by requests only. A node is a candidate
  when the requests fit its remaining cpu, memory, and GPU devices,
  every nodeSelector entry matches a node label, and every
  NoSchedule taint is tolerated. Among candidates: lowest cpu
  utilisation, ties by node name. No candidate: Pending, with the
  distinct failure categories named, sorted.
- Node usage and quota usage count Running pods for nodes, and
  Running or Pending pods for quota. Terminal pods free both.
- A Job runs attempts sequentially. Each attempt is one pod. A
  failed attempt retries while retries used stays within
  max_retries. Attempt outcomes are declared in the job spec
  (fail_attempts), so the whole run is reproducible by hand.
"""


class Taint:
    def __init__(self, key, value, effect):
        self.key = key
        self.value = value
        self.effect = effect

    def label(self):
        return self.key + "=" + self.value + ":" + self.effect


class Toleration:
    def __init__(self, key, effect):
        self.key = key
        self.effect = effect

    def tolerates(self, taint):
        return self.key == taint.key and self.effect == taint.effect


class Node:
    def __init__(self, name, cpu_m, mem_mib, gpu=0, labels=None,
                 taints=None):
        self.name = name
        self.cpu_m = cpu_m
        self.mem_mib = mem_mib
        self.gpu = gpu
        self.labels = dict(labels) if labels else {}
        self.taints = list(taints) if taints else []


class Namespace:
    def __init__(self, name, quota_cpu_m, quota_mem_mib, quota_gpu,
                 quota_pods):
        self.name = name
        self.quota = {"cpu_m": quota_cpu_m, "mem_mib": quota_mem_mib,
                      "gpu": quota_gpu, "pods": quota_pods}


class Pod:
    def __init__(self, name, namespace, labels, cpu_req_m, cpu_lim_m,
                 mem_req_mib, mem_lim_mib, gpu=0, node_selector=None,
                 tolerations=None, owner=None, kind="pod"):
        self.name = name
        self.namespace = namespace
        self.labels = dict(labels)
        self.cpu_req_m = cpu_req_m
        self.cpu_lim_m = cpu_lim_m
        self.mem_req_mib = mem_req_mib
        self.mem_lim_mib = mem_lim_mib
        self.gpu = gpu
        self.node_selector = dict(node_selector) if node_selector else {}
        self.tolerations = list(tolerations) if tolerations else []
        self.owner = owner
        self.kind = kind
        self.status = "Pending"
        self.node = None
        self.reason = None


class Service:
    def __init__(self, name, namespace, selector, port, target_port,
                 kind="plain"):
        self.name = name
        self.namespace = namespace
        self.selector = dict(selector)
        self.port = port
        self.target_port = target_port
        self.kind = kind


class Job:
    def __init__(self, name, namespace, labels, cpu_req_m, cpu_lim_m,
                 mem_req_mib, mem_lim_mib, gpu=0, node_selector=None,
                 tolerations=None, ticks_needed=1, fail_attempts=0,
                 max_retries=0):
        self.name = name
        self.namespace = namespace
        self.labels = dict(labels)
        self.cpu_req_m = cpu_req_m
        self.cpu_lim_m = cpu_lim_m
        self.mem_req_mib = mem_req_mib
        self.mem_lim_mib = mem_lim_mib
        self.gpu = gpu
        self.node_selector = dict(node_selector) if node_selector else {}
        self.tolerations = list(tolerations) if tolerations else []
        self.ticks_needed = ticks_needed
        self.fail_attempts = fail_attempts
        self.max_retries = max_retries
        self.status = "Queued"
        self.attempts = 0
        self.retries = 0
        self.ticks_total = 0
        self.pod_names = []

    def pod_for_attempt(self, attempt):
        return Pod(self.name + "-" + str(attempt), self.namespace,
                   self.labels, self.cpu_req_m, self.cpu_lim_m,
                   self.mem_req_mib, self.mem_lim_mib, gpu=self.gpu,
                   node_selector=self.node_selector,
                   tolerations=self.tolerations, owner=self.name,
                   kind="job")


class InferenceService:
    """KServe-style object: a model declaration, not just a Service."""

    def __init__(self, name, namespace, model_name, storage_uri,
                 labels, cpu_req_m, cpu_lim_m, mem_req_mib,
                 mem_lim_mib, replicas, min_replicas, max_replicas,
                 target_metric):
        self.name = name
        self.namespace = namespace
        self.model_name = model_name
        self.storage_uri = storage_uri
        self.labels = dict(labels)
        self.cpu_req_m = cpu_req_m
        self.cpu_lim_m = cpu_lim_m
        self.mem_req_mib = mem_req_mib
        self.mem_lim_mib = mem_lim_mib
        self.replicas = replicas
        self.min_replicas = min_replicas
        self.max_replicas = max_replicas
        self.target_metric = target_metric

    def spec_dict(self):
        return {
            "name": self.name, "namespace": self.namespace,
            "model_name": self.model_name,
            "storage_uri": self.storage_uri,
            "predictor_replicas": self.replicas,
            "min_replicas": self.min_replicas,
            "max_replicas": self.max_replicas,
            "target_metric": self.target_metric,
            "predictor_cpu_req_m": self.cpu_req_m,
            "predictor_mem_req_mib": self.mem_req_mib,
        }


class Cluster:
    def __init__(self):
        self.nodes = {}
        self.namespaces = {}
        self.pods = {}
        self.services = {}
        self.jobs = {}
        self.inference_services = {}
        self.rejections = []

    def add_node(self, node):
        self.nodes[node.name] = node

    def add_namespace(self, namespace):
        self.namespaces[namespace.name] = namespace

    def add_service(self, service):
        self.services[service.name] = service

    def node_usage(self, node_name):
        cpu = 0
        mem = 0
        gpu = 0
        names = []
        for pod in self.pods.values():
            if pod.status == "Running" and pod.node == node_name:
                cpu += pod.cpu_req_m
                mem += pod.mem_req_mib
                gpu += pod.gpu
                names.append(pod.name)
        return {"cpu_m": cpu, "mem_mib": mem, "gpu": gpu,
                "pods": sorted(names)}

    def quota_usage(self, namespace):
        cpu = 0
        mem = 0
        gpu = 0
        count = 0
        for pod in self.pods.values():
            if pod.namespace != namespace:
                continue
            if pod.status not in ("Running", "Pending"):
                continue
            cpu += pod.cpu_req_m
            mem += pod.mem_req_mib
            gpu += pod.gpu
            count += 1
        return {"cpu_m": cpu, "mem_mib": mem, "gpu": gpu, "pods": count}

    def validate(self, pod):
        if pod.cpu_lim_m < pod.cpu_req_m:
            return "cpu limit below request"
        if pod.mem_lim_mib < pod.mem_req_mib:
            return "memory limit below request"
        return None

    def quota_check(self, pod):
        ns = self.namespaces[pod.namespace]
        usage = self.quota_usage(pod.namespace)
        checks = [
            ("cpu_m", usage["cpu_m"], pod.cpu_req_m, ns.quota["cpu_m"]),
            ("mem_mib", usage["mem_mib"], pod.mem_req_mib,
             ns.quota["mem_mib"]),
            ("gpu", usage["gpu"], pod.gpu, ns.quota["gpu"]),
            ("pods", usage["pods"], 1, ns.quota["pods"]),
        ]
        for resource, used, requested, quota in checks:
            if used + requested > quota:
                return ("QuotaExceeded: " + resource + " in namespace "
                        + pod.namespace + ": used " + str(used)
                        + " + requested " + str(requested)
                        + " > quota " + str(quota))
        return None

    def schedule(self, pod):
        best = None
        best_key = None
        failures = set()
        for name in sorted(self.nodes):
            node = self.nodes[name]
            usage = self.node_usage(name)
            node_failures = []
            if (usage["cpu_m"] + pod.cpu_req_m > node.cpu_m
                    or usage["mem_mib"] + pod.mem_req_mib > node.mem_mib
                    or usage["gpu"] + pod.gpu > node.gpu):
                node_failures.append(
                    "Insufficient cpu or memory or gpu")
            for key, value in sorted(pod.node_selector.items()):
                if node.labels.get(key) != value:
                    node_failures.append("nodeSelector mismatch")
                    break
            for taint in node.taints:
                if taint.effect != "NoSchedule":
                    continue
                if not any(t.tolerates(taint) for t in pod.tolerations):
                    node_failures.append(
                        "taint " + taint.label() + " not tolerated")
            if node_failures:
                failures.update(node_failures)
                continue
            key = (usage["cpu_m"] / node.cpu_m, name)
            if best_key is None or key < best_key:
                best_key = key
                best = name
        if best is None:
            pod.status = "Pending"
            pod.node = None
            pod.reason = ("Unschedulable: "
                          + "; ".join(sorted(failures)))
            return pod
        pod.status = "Running"
        pod.node = best
        pod.reason = None
        return pod

    def admit(self, pod):
        """Validate, quota-check, register, and schedule one pod.

        Returns the pod when admitted (Running or Pending), or None
        when rejected, with the rejection recorded in order.
        """
        problem = self.validate(pod)
        if problem is None:
            problem = self.quota_check(pod)
        if problem is not None:
            self.rejections.append({
                "pod": pod.name, "namespace": pod.namespace,
                "reason": problem})
            return None
        self.pods[pod.name] = pod
        return self.schedule(pod)

    def endpoints(self, service_name):
        svc = self.services[service_name]
        out = []
        for pod in self.pods.values():
            if pod.status != "Running":
                continue
            if pod.namespace != svc.namespace:
                continue
            if all(pod.labels.get(k) == v
                   for k, v in svc.selector.items()):
                out.append(pod.name)
        return sorted(out)

    def route_requests(self, service_name, count):
        eps = self.endpoints(service_name)
        counts = {name: 0 for name in eps}
        if not eps:
            return counts
        for i in range(count):
            counts[eps[i % len(eps)]] += 1
        return counts

    def apply_inference_service(self, isvc):
        self.inference_services[isvc.name] = isvc
        created = []
        for i in range(isvc.replicas):
            pod = Pod(isvc.name + "-predictor-" + str(i), isvc.namespace,
                      isvc.labels, isvc.cpu_req_m, isvc.cpu_lim_m,
                      isvc.mem_req_mib, isvc.mem_lim_mib,
                      owner=isvc.name, kind="predictor")
            admitted = self.admit(pod)
            if admitted is not None:
                created.append(admitted.name)
        self.add_service(Service(isvc.name + "-svc", isvc.namespace,
                                 isvc.labels, 80, 8080, kind="kserve"))
        return created

    def run_job(self, job):
        """Run one job to a terminal state, sequentially.

        The first attempt pod must already be admitted. Later
        attempts are admitted and scheduled at retry time, against
        the cluster state left by earlier jobs and attempts.
        """
        self.jobs[job.name] = job
        attempt = 0
        while True:
            pod = self.pods[job.name + "-" + str(attempt)]
            job.attempts += 1
            job.pod_names.append(pod.name)
            if pod.status != "Running":
                job.status = "Failed"
                pod.reason = pod.reason or "attempt pod not Running"
                return job
            job.status = "Running"
            job.ticks_total += job.ticks_needed
            if attempt < job.fail_attempts:
                pod.status = "Failed"
                pod.reason = "attempt failed (declared failure)"
                if job.retries < job.max_retries:
                    job.retries += 1
                    attempt += 1
                    nxt = job.pod_for_attempt(attempt)
                    admitted = self.admit(nxt)
                    if admitted is None:
                        job.status = "Failed"
                        return job
                    continue
                job.status = "Failed"
                return job
            pod.status = "Succeeded"
            pod.reason = None
            job.status = "Succeeded"
            return job

    def job_record(self, job):
        return {
            "name": job.name, "namespace": job.namespace,
            "status": job.status, "attempts": job.attempts,
            "retries": job.retries, "ticks_total": job.ticks_total,
            "pod_names": list(job.pod_names),
            "cpu_req_m": job.cpu_req_m, "mem_req_mib": job.mem_req_mib,
            "gpu": job.gpu,
        }
