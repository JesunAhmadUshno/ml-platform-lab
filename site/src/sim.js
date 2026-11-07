// JavaScript ports of the three simulations, line for line with the Python:
//   level-1-learn/cluster.py + run_learn.py
//   level-2-build/platform.py + run_build.py
//   level-3-deep/deep_operator.py + run_deep.py
// Python dicts keep insertion order, and so do JS Maps, so iteration order matches.
// Names are compared by code point (ASCII here), the same order Python's sorted() uses.
// src/sim.check.mjs replays each runner and deep-compares the output with the
// committed results JSON during `npm run build`, so the playgrounds are the repo's rules.

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sortedKeys = (m) => [...m.keys()].sort(byName);
const sortedStr = (arr) => [...arr].sort(byName);
// Python tuple comparison of (utilisation, name).
const keyLess = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/* ============================ Learn: cluster.py ============================ */
export const learn = {};

learn.Node = class { constructor(name, cpu_m, mem_mib) { Object.assign(this, { name, cpu_m, mem_mib }); } };
learn.ConfigMap = class { constructor(name, data) { this.name = name; this.data = { ...data }; } };
learn.Pod = class {
  constructor(name, labels, cpu_m, mem_mib, owner = null, config = null) {
    Object.assign(this, { name, labels: { ...labels }, cpu_m, mem_mib, owner, config: config ? { ...config } : {} });
    this.status = 'Pending'; this.node = null; this.reason = null;
  }
};
learn.Deployment = class {
  constructor(name, replicas, labels, cpu_m, mem_mib, configmap = null) {
    Object.assign(this, { name, replicas, labels: { ...labels }, cpu_m, mem_mib, configmap }); this.counter = 0;
  }
};
learn.Service = class { constructor(name, selector, port, target_port) { Object.assign(this, { name, selector: { ...selector }, port, target_port }); } };

learn.Cluster = class {
  constructor() { this.nodes = new Map(); this.configmaps = new Map(); this.pods = new Map(); this.deployments = new Map(); this.services = new Map(); }
  add_node(n) { this.nodes.set(n.name, n); }
  add_configmap(c) { this.configmaps.set(c.name, c); }
  update_configmap(name, key, value) { this.configmaps.get(name).data[key] = value; }
  config_snapshot(dep) { return dep.configmap === null ? {} : { ...this.configmaps.get(dep.configmap).data }; }
  node_usage(nodeName) {
    let cpu = 0, mem = 0; const names = [];
    for (const p of this.pods.values()) if (p.status === 'Running' && p.node === nodeName) { cpu += p.cpu_m; mem += p.mem_mib; names.push(p.name); }
    return { cpu_m: cpu, mem_mib: mem, pods: sortedStr(names) };
  }
  schedule(pod) {
    let best = null, bestKey = null;
    for (const name of sortedKeys(this.nodes)) {
      const node = this.nodes.get(name), u = this.node_usage(name);
      if (u.cpu_m + pod.cpu_m > node.cpu_m) continue;
      if (u.mem_mib + pod.mem_mib > node.mem_mib) continue;
      const key = [u.cpu_m / node.cpu_m, name];
      if (bestKey === null || keyLess(key, bestKey)) { bestKey = key; best = name; }
    }
    if (best === null) { pod.status = 'Pending'; pod.node = null; pod.reason = 'Insufficient cpu or memory on every node'; return pod; }
    pod.status = 'Running'; pod.node = best; pod.reason = null; return pod;
  }
  create_pod(name, labels, cpu_m, mem_mib, owner = null, config = null) {
    const pod = new learn.Pod(name, labels, cpu_m, mem_mib, owner, config);
    this.pods.set(name, pod);
    return this.schedule(pod);
  }
  delete_pod(name) { const p = this.pods.get(name); p.status = 'Deleted'; p.node = null; return p; }
  live_pods(depName) { return [...this.pods.values()].filter((p) => p.owner === depName && p.status !== 'Deleted'); }
  apply_deployment(dep) { this.deployments.set(dep.name, dep); return this.reconcile(dep.name); }
  reconcile(depName) {
    const dep = this.deployments.get(depName); const created = [];
    let live = this.live_pods(depName);
    while (live.length < dep.replicas) {
      const name = `${dep.name}-${dep.counter}`; dep.counter += 1;
      const pod = this.create_pod(name, dep.labels, dep.cpu_m, dep.mem_mib, dep.name, this.config_snapshot(dep));
      created.push(pod.name); live = this.live_pods(depName);
    }
    return created;
  }
  scale(depName, replicas) {
    const dep = this.deployments.get(depName); dep.replicas = replicas;
    const created = this.reconcile(depName);
    const live = this.live_pods(depName).sort((a, b) => byName(a.name, b.name)); const removed = [];
    while (live.length > replicas) { const v = live.pop(); this.delete_pod(v.name); removed.push(v.name); }
    return { created, removed };
  }
  add_service(s) { this.services.set(s.name, s); }
  endpoints(svcName) {
    const svc = this.services.get(svcName); const out = [];
    for (const p of this.pods.values()) {
      if (p.status !== 'Running') continue;
      if (Object.entries(svc.selector).every(([k, v]) => p.labels[k] === v)) out.push(p.name);
    }
    return sortedStr(out);
  }
  route_requests(svcName, count) {
    const eps = this.endpoints(svcName); const counts = Object.fromEntries(eps.map((n) => [n, 0]));
    if (!eps.length) return counts;
    for (let i = 0; i < count; i++) counts[eps[i % eps.length]] += 1;
    return counts;
  }
};

// Scenario inputs from run_learn.py.
export const LEARN_NODES = [['node-r610', 8000, 16384], ['node-v2', 4000, 8192], ['node-v3', 4000, 8192]];
export const LEARN_CONFIG = { MODEL_NAME: 'tiny-gpt', MAX_BATCH: '8', LOG_LEVEL: 'info' };

export function learnBase() {
  const c = new learn.Cluster();
  for (const [n, cpu, mem] of LEARN_NODES) c.add_node(new learn.Node(n, cpu, mem));
  c.add_configmap(new learn.ConfigMap('api-config', LEARN_CONFIG));
  c.apply_deployment(new learn.Deployment('api', 3, { app: 'api' }, 500, 512, 'api-config'));
  c.apply_deployment(new learn.Deployment('worker', 2, { app: 'worker' }, 1000, 1024));
  c.create_pod('debug', { app: 'debug' }, 250, 256);
  c.add_service(new learn.Service('api-svc', { app: 'api' }, 80, 8080));
  return c;
}

const usageAll = (c) => Object.fromEntries(sortedKeys(c.nodes).map((n) => [n, c.node_usage(n)]));
const placeOf = (c, names) => Object.fromEntries(names.map((n) => [n, c.pods.get(n).node]));

// The run_learn.py scenario. Returns the cluster and the results object
// (without the runner's descriptive metadata: project, level, simulated, note).
export function replayLearn() {
  const c = learnBase();
  const initial_placement = placeOf(c, ['api-0', 'api-1', 'api-2', 'worker-0', 'worker-1', 'debug']);
  const endpoints_initial = c.endpoints('api-svc');
  const routing = c.route_requests('api-svc', 6);
  c.delete_pod('api-1');
  const usage_after_delete = usageAll(c);
  const created_heal = c.reconcile('api');
  const heal_placement = placeOf(c, created_heal);
  const endpoints_after_heal = c.endpoints('api-svc');
  const scaled = c.scale('worker', 3);
  const scale_placement = placeOf(c, scaled.created);
  const huge = c.create_pod('huge', { app: 'huge' }, 16000, 1024);
  c.update_configmap('api-config', 'MAX_BATCH', '16');
  const stale_before_rollout = sortedStr([...c.pods.values()].filter((p) => p.owner === 'api' && p.status === 'Running' && p.config.MAX_BATCH === '8').map((p) => p.name));
  c.delete_pod('api-0');
  const created_rollout = c.reconcile('api');
  const rollout_placement = placeOf(c, created_rollout);
  return { cluster: c, results: learnResults(c, { initial_placement, endpoints_initial, routing_6_requests: routing, usage_after_delete_api_1: usage_after_delete, heal_created: created_heal, heal_placement, endpoints_after_heal, scale_created: scaled.created, scale_placement, huge_pod: { status: huge.status, reason: huge.reason }, stale_before_rollout, rollout_created: created_rollout, rollout_placement }, created_heal, created_rollout) };
}

export function learnPodsFinal(c) {
  return sortedKeys(c.pods).map((name) => {
    const p = c.pods.get(name);
    return { name: p.name, owner: p.owner, status: p.status, node: p.node, cpu_m: p.cpu_m, mem_mib: p.mem_mib, max_batch: p.config.MAX_BATCH ?? null, reason: p.reason };
  });
}

function learnResults(c, parts, created_heal, created_rollout) {
  const pods_final = learnPodsFinal(c);
  const running = pods_final.filter((p) => p.status === 'Running');
  const apiRunning = running.filter((p) => p.owner === 'api');
  const sum = (a, k) => a.reduce((s, p) => s + p[k], 0);
  return {
    ...parts,
    endpoints_final: c.endpoints('api-svc'),
    pods_final,
    node_usage_final: usageAll(c),
    summary: {
      pods_created_total: pods_final.length,
      pods_running: running.length,
      pods_pending: pods_final.filter((p) => p.status === 'Pending').length,
      pods_deleted: pods_final.filter((p) => p.status === 'Deleted').length,
      endpoints_final_count: c.endpoints('api-svc').length,
      total_running_cpu_m: sum(running, 'cpu_m'),
      total_running_mem_mib: sum(running, 'mem_mib'),
      api_pods_stale_max_batch_8: apiRunning.filter((p) => p.max_batch === '8').length,
      api_pods_fresh_max_batch_16: apiRunning.filter((p) => p.max_batch === '16').length,
      retries_or_recreates: created_heal.length + created_rollout.length,
    },
  };
}

/* ============================ Build: platform.py ============================ */
export const build = {};

build.Taint = class { constructor(key, value, effect) { Object.assign(this, { key, value, effect }); } label() { return `${this.key}=${this.value}:${this.effect}`; } };
build.Toleration = class { constructor(key, effect) { Object.assign(this, { key, effect }); } tolerates(t) { return this.key === t.key && this.effect === t.effect; } };
build.Node = class {
  constructor(name, cpu_m, mem_mib, gpu = 0, labels = null, taints = null) {
    Object.assign(this, { name, cpu_m, mem_mib, gpu, labels: labels ? { ...labels } : {}, taints: taints ? [...taints] : [] });
  }
};
build.Namespace = class { constructor(name, cpu, mem, gpu, pods) { this.name = name; this.quota = { cpu_m: cpu, mem_mib: mem, gpu, pods }; } };
build.Pod = class {
  constructor(name, namespace, labels, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, { gpu = 0, node_selector = null, tolerations = null, owner = null, kind = 'pod' } = {}) {
    Object.assign(this, { name, namespace, labels: { ...labels }, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, gpu, node_selector: node_selector ? { ...node_selector } : {}, tolerations: tolerations ? [...tolerations] : [], owner, kind });
    this.status = 'Pending'; this.node = null; this.reason = null;
  }
};
build.Service = class { constructor(name, namespace, selector, port, target_port, kind = 'plain') { Object.assign(this, { name, namespace, selector: { ...selector }, port, target_port, kind }); } };
build.Job = class {
  constructor(name, namespace, labels, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, { gpu = 0, node_selector = null, tolerations = null, ticks_needed = 1, fail_attempts = 0, max_retries = 0 } = {}) {
    Object.assign(this, { name, namespace, labels: { ...labels }, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, gpu, node_selector: node_selector ? { ...node_selector } : {}, tolerations: tolerations ? [...tolerations] : [], ticks_needed, fail_attempts, max_retries });
    this.status = 'Queued'; this.attempts = 0; this.retries = 0; this.ticks_total = 0; this.pod_names = [];
  }
  pod_for_attempt(a) {
    return new build.Pod(`${this.name}-${a}`, this.namespace, this.labels, this.cpu_req_m, this.cpu_lim_m, this.mem_req_mib, this.mem_lim_mib, { gpu: this.gpu, node_selector: this.node_selector, tolerations: this.tolerations, owner: this.name, kind: 'job' });
  }
};
build.InferenceService = class {
  constructor(name, namespace, model_name, storage_uri, labels, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, replicas, min_replicas, max_replicas, target_metric) {
    Object.assign(this, { name, namespace, model_name, storage_uri, labels: { ...labels }, cpu_req_m, cpu_lim_m, mem_req_mib, mem_lim_mib, replicas, min_replicas, max_replicas, target_metric });
  }
  spec_dict() {
    return { name: this.name, namespace: this.namespace, model_name: this.model_name, storage_uri: this.storage_uri, predictor_replicas: this.replicas, min_replicas: this.min_replicas, max_replicas: this.max_replicas, target_metric: this.target_metric, predictor_cpu_req_m: this.cpu_req_m, predictor_mem_req_mib: this.mem_req_mib };
  }
};

build.Cluster = class {
  constructor() { this.nodes = new Map(); this.namespaces = new Map(); this.pods = new Map(); this.services = new Map(); this.jobs = new Map(); this.inference_services = new Map(); this.rejections = []; }
  add_node(n) { this.nodes.set(n.name, n); }
  add_namespace(n) { this.namespaces.set(n.name, n); }
  add_service(s) { this.services.set(s.name, s); }
  node_usage(nodeName) {
    let cpu = 0, mem = 0, gpu = 0; const names = [];
    for (const p of this.pods.values()) if (p.status === 'Running' && p.node === nodeName) { cpu += p.cpu_req_m; mem += p.mem_req_mib; gpu += p.gpu; names.push(p.name); }
    return { cpu_m: cpu, mem_mib: mem, gpu, pods: sortedStr(names) };
  }
  quota_usage(ns) {
    let cpu = 0, mem = 0, gpu = 0, count = 0;
    for (const p of this.pods.values()) {
      if (p.namespace !== ns) continue;
      if (p.status !== 'Running' && p.status !== 'Pending') continue;
      cpu += p.cpu_req_m; mem += p.mem_req_mib; gpu += p.gpu; count += 1;
    }
    return { cpu_m: cpu, mem_mib: mem, gpu, pods: count };
  }
  validate(pod) {
    if (pod.cpu_lim_m < pod.cpu_req_m) return 'cpu limit below request';
    if (pod.mem_lim_mib < pod.mem_req_mib) return 'memory limit below request';
    return null;
  }
  quota_check(pod) {
    const ns = this.namespaces.get(pod.namespace), u = this.quota_usage(pod.namespace);
    const checks = [['cpu_m', u.cpu_m, pod.cpu_req_m, ns.quota.cpu_m], ['mem_mib', u.mem_mib, pod.mem_req_mib, ns.quota.mem_mib], ['gpu', u.gpu, pod.gpu, ns.quota.gpu], ['pods', u.pods, 1, ns.quota.pods]];
    for (const [res, used, req, quota] of checks)
      if (used + req > quota) return `QuotaExceeded: ${res} in namespace ${pod.namespace}: used ${used} + requested ${req} > quota ${quota}`;
    return null;
  }
  // Also returns the per-node verdicts so the page can show why each node was or was not a candidate.
  schedule(pod) {
    let best = null, bestKey = null; const failures = new Set(); const perNode = [];
    for (const name of sortedKeys(this.nodes)) {
      const node = this.nodes.get(name), u = this.node_usage(name), nf = [];
      if (u.cpu_m + pod.cpu_req_m > node.cpu_m || u.mem_mib + pod.mem_req_mib > node.mem_mib || u.gpu + pod.gpu > node.gpu) nf.push('Insufficient cpu or memory or gpu');
      for (const [k, v] of Object.entries(pod.node_selector).sort((a, b) => byName(a[0], b[0]))) if (node.labels[k] !== v) { nf.push('nodeSelector mismatch'); break; }
      for (const t of node.taints) {
        if (t.effect !== 'NoSchedule') continue;
        if (!pod.tolerations.some((tol) => tol.tolerates(t))) nf.push(`taint ${t.label()} not tolerated`);
      }
      perNode.push({ node: name, failures: nf, util: u.cpu_m / node.cpu_m });
      if (nf.length) { nf.forEach((f) => failures.add(f)); continue; }
      const key = [u.cpu_m / node.cpu_m, name];
      if (bestKey === null || keyLess(key, bestKey)) { bestKey = key; best = name; }
    }
    this.lastPerNode = perNode;
    if (best === null) { pod.status = 'Pending'; pod.node = null; pod.reason = `Unschedulable: ${sortedStr(failures).join('; ')}`; return pod; }
    pod.status = 'Running'; pod.node = best; pod.reason = null; return pod;
  }
  admit(pod) {
    let problem = this.validate(pod);
    if (problem === null) problem = this.quota_check(pod);
    if (problem !== null) { this.rejections.push({ pod: pod.name, namespace: pod.namespace, reason: problem }); return null; }
    this.pods.set(pod.name, pod);
    return this.schedule(pod);
  }
  endpoints(svcName) {
    const svc = this.services.get(svcName); const out = [];
    for (const p of this.pods.values()) {
      if (p.status !== 'Running' || p.namespace !== svc.namespace) continue;
      if (Object.entries(svc.selector).every(([k, v]) => p.labels[k] === v)) out.push(p.name);
    }
    return sortedStr(out);
  }
  route_requests(svcName, count) { return learn.Cluster.prototype.route_requests.call(this, svcName, count); }
  apply_inference_service(isvc) {
    this.inference_services.set(isvc.name, isvc); const created = [];
    for (let i = 0; i < isvc.replicas; i++) {
      const pod = new build.Pod(`${isvc.name}-predictor-${i}`, isvc.namespace, isvc.labels, isvc.cpu_req_m, isvc.cpu_lim_m, isvc.mem_req_mib, isvc.mem_lim_mib, { owner: isvc.name, kind: 'predictor' });
      const a = this.admit(pod); if (a !== null) created.push(a.name);
    }
    this.add_service(new build.Service(`${isvc.name}-svc`, isvc.namespace, isvc.labels, 80, 8080, 'kserve'));
    return created;
  }
  run_job(job) {
    this.jobs.set(job.name, job); let attempt = 0;
    for (;;) {
      const pod = this.pods.get(`${job.name}-${attempt}`);
      job.attempts += 1; job.pod_names.push(pod.name);
      if (pod.status !== 'Running') { job.status = 'Failed'; pod.reason = pod.reason || 'attempt pod not Running'; return job; }
      job.status = 'Running'; job.ticks_total += job.ticks_needed;
      if (attempt < job.fail_attempts) {
        pod.status = 'Failed'; pod.reason = 'attempt failed (declared failure)';
        if (job.retries < job.max_retries) {
          job.retries += 1; attempt += 1;
          if (this.admit(job.pod_for_attempt(attempt)) === null) { job.status = 'Failed'; return job; }
          continue;
        }
        job.status = 'Failed'; return job;
      }
      pod.status = 'Succeeded'; pod.reason = null; job.status = 'Succeeded'; return job;
    }
  }
  job_record(job) {
    return { name: job.name, namespace: job.namespace, status: job.status, attempts: job.attempts, retries: job.retries, ticks_total: job.ticks_total, pod_names: [...job.pod_names], cpu_req_m: job.cpu_req_m, mem_req_mib: job.mem_req_mib, gpu: job.gpu };
  }
};

// Scenario inputs from run_build.py.
const GPU_TOL = () => [new build.Toleration('gpu', 'NoSchedule')];
const GPU_SEL = { accelerator: 'nvidia-t4' };
export const BUILD_NODES = [
  ['node-cpu-a', 8000, 16384, 0, { zone: 'cpu', pool: 'general' }, false],
  ['node-cpu-b', 8000, 16384, 0, { zone: 'cpu', pool: 'general' }, false],
  ['node-gpu-a', 8000, 16384, 2, { accelerator: 'nvidia-t4', pool: 'gpu' }, true],
  ['node-gpu-b', 8000, 16384, 1, { accelerator: 'nvidia-t4', pool: 'gpu' }, true],
];
export const BUILD_NAMESPACES = [['team-train', 24000, 49152, 2, 10], ['team-serve', 8000, 16384, 1, 6], ['team-sandbox', 2000, 4096, 0, 3]];
const JOBS = () => [
  new build.Job('train-v1', 'team-train', { app: 'train-v1' }, 4000, 6000, 8192, 12288, { gpu: 1, node_selector: GPU_SEL, tolerations: GPU_TOL(), ticks_needed: 3, fail_attempts: 0, max_retries: 0 }),
  new build.Job('train-flaky', 'team-train', { app: 'train-flaky' }, 2000, 3000, 4096, 6144, { gpu: 1, node_selector: GPU_SEL, tolerations: GPU_TOL(), ticks_needed: 2, fail_attempts: 1, max_retries: 2 }),
  new build.Job('train-doomed', 'team-train', { app: 'train-doomed' }, 1000, 1500, 2048, 3072, { gpu: 0, ticks_needed: 1, fail_attempts: 99, max_retries: 1 }),
];
// The four admission probes from run_build.py, as plain specs the page can load into its form.
export const BUILD_PROBES = [
  { name: 'train-gpu-blocked-0', namespace: 'team-train', cpu_req_m: 1000, cpu_lim_m: 1500, mem_req_mib: 2048, mem_lim_mib: 3072, gpu: 1, selector: true, toleration: true, owner: 'train-gpu-blocked', kind: 'job' },
  { name: 'sandbox-gpu', namespace: 'team-sandbox', cpu_req_m: 500, cpu_lim_m: 750, mem_req_mib: 512, mem_lim_mib: 768, gpu: 1, selector: true, toleration: true, kind: 'pod' },
  { name: 'gpu-curious', namespace: 'team-serve', cpu_req_m: 500, cpu_lim_m: 750, mem_req_mib: 512, mem_lim_mib: 768, gpu: 0, selector: true, toleration: false, kind: 'pod' },
  { name: 'train-huge', namespace: 'team-train', cpu_req_m: 16000, cpu_lim_m: 16000, mem_req_mib: 1024, mem_lim_mib: 1024, gpu: 0, selector: false, toleration: true, kind: 'pod' },
];
export function podFromSpec(s) {
  return new build.Pod(s.name, s.namespace, { app: s.name }, s.cpu_req_m, s.cpu_lim_m, s.mem_req_mib, s.mem_lim_mib, { gpu: s.gpu, node_selector: s.selector ? GPU_SEL : null, tolerations: s.toleration ? GPU_TOL() : null, owner: s.owner ?? null, kind: s.kind ?? 'pod' });
}

// stage: 'admission' stops after the probes (before any job runs); 'final' runs the whole scenario.
export function buildScenario(stage = 'final') {
  const c = new build.Cluster();
  const taint = new build.Taint('gpu', 'true', 'NoSchedule');
  for (const [n, cpu, mem, gpu, labels, tainted] of BUILD_NODES) c.add_node(new build.Node(n, cpu, mem, gpu, labels, tainted ? [taint] : null));
  for (const [n, ...q] of BUILD_NAMESPACES) c.add_namespace(new build.Namespace(n, ...q));
  const jobs = JOBS();
  for (const j of jobs) c.admit(j.pod_for_attempt(0));
  const first_attempt_placement = Object.fromEntries(jobs.map((j) => [j.name, c.pods.get(`${j.name}-0`).node]));
  const plain = [];
  for (let i = 0; i < 2; i++) plain.push(c.admit(new build.Pod(`serve-plain-${i}`, 'team-serve', { app: 'serve-plain' }, 1000, 1500, 2048, 3072, { owner: 'serve-plain', kind: 'serving' })).name);
  c.add_service(new build.Service('serve-plain-svc', 'team-serve', { app: 'serve-plain' }, 80, 8080, 'plain'));
  const isvc = new build.InferenceService('serve-kserve', 'team-serve', 'tiny-gpt', 's3://simulated-bucket/models/tiny-gpt (simulated string, nothing downloaded)', { app: 'serve-kserve' }, 1500, 2000, 3072, 4096, 2, 1, 3, 'concurrency 10 per predictor (declared only)');
  const kserve = c.apply_inference_service(isvc);
  const serving_placement = placeOf(c, [...plain, ...kserve]);
  const [blocked, sandbox, curiousSpec, hugeSpec] = BUILD_PROBES;
  c.admit(podFromSpec(blocked)); c.admit(podFromSpec(sandbox));
  const curious = c.admit(podFromSpec(curiousSpec));
  const huge = c.admit(podFromSpec(hugeSpec));
  const quota_at_admission = Object.fromEntries(sortedKeys(c.namespaces).map((ns) => [ns, c.quota_usage(ns)]));
  const probes = { gpu_curious: { status: curious.status, reason: curious.reason }, train_huge: { status: huge.status, reason: huge.reason } };
  if (stage === 'admission') return { cluster: c };
  for (const j of jobs) c.run_job(j);
  const jobRecords = jobs.map((j) => c.job_record(j));
  const plainRouting = c.route_requests('serve-plain-svc', 10), kserveRouting = c.route_requests('serve-kserve-svc', 10);
  const pods_final = sortedKeys(c.pods).map((n) => {
    const p = c.pods.get(n);
    return { name: p.name, namespace: p.namespace, kind: p.kind, owner: p.owner, status: p.status, node: p.node, cpu_req_m: p.cpu_req_m, cpu_lim_m: p.cpu_lim_m, mem_req_mib: p.mem_req_mib, mem_lim_mib: p.mem_lim_mib, gpu: p.gpu, reason: p.reason };
  });
  const running = pods_final.filter((p) => p.status === 'Running');
  const sum = (a, k) => a.reduce((s, p) => s + p[k], 0);
  const namespace_running_final = Object.fromEntries(sortedKeys(c.namespaces).map((ns) => {
    const r = running.filter((p) => p.namespace === ns);
    return [ns, { cpu_m: sum(r, 'cpu_req_m'), mem_mib: sum(r, 'mem_req_mib'), gpu: sum(r, 'gpu'), pods: r.length }];
  }));
  const gpuPods = pods_final.filter((p) => p.gpu > 0 && p.node !== null);
  const results = {
    first_attempt_placement, serving_placement, quota_at_admission, rejections: c.rejections, probes, jobs: jobRecords,
    serving_comparison: {
      plain_service: { backing_object: 'Service serve-plain-svc', model_declared: false, storage_uri_declared: false, autoscaling_bounds_declared: false, endpoints: c.endpoints('serve-plain-svc'), requests_routed_10: plainRouting },
      kserve_style: { backing_object: 'InferenceService serve-kserve', model_declared: true, storage_uri_declared: true, autoscaling_bounds_declared: true, endpoints: c.endpoints('serve-kserve-svc'), requests_routed_10: kserveRouting, spec: isvc.spec_dict() },
    },
    pods_final, node_usage_final: usageAll(c), namespace_running_final,
    summary: {
      pods_admitted: pods_final.length, pods_running: running.length,
      pods_succeeded: pods_final.filter((p) => p.status === 'Succeeded').length,
      pods_failed: pods_final.filter((p) => p.status === 'Failed').length,
      pods_pending: pods_final.filter((p) => p.status === 'Pending').length,
      admission_rejected: c.rejections.length,
      jobs_succeeded: jobRecords.filter((j) => j.status === 'Succeeded').length,
      jobs_failed: jobRecords.filter((j) => j.status === 'Failed').length,
      jobs_total_attempts: sum(jobRecords, 'attempts'), jobs_total_retries: sum(jobRecords, 'retries'), jobs_ticks_total: sum(jobRecords, 'ticks_total'),
      gpu_pods_placed: gpuPods.length, gpu_nodes_used: sortedStr(new Set(gpuPods.map((p) => p.node))),
      plain_endpoints: c.endpoints('serve-plain-svc').length, kserve_endpoints: c.endpoints('serve-kserve-svc').length,
      total_running_cpu_m: sum(running, 'cpu_req_m'), total_running_mem_mib: sum(running, 'mem_req_mib'),
    },
  };
  return { cluster: c, results, jobs };
}

/* ============================ Deep: deep_operator.py ============================ */
export const deep = {};

deep.ModelEndpoint = class {
  constructor(name, namespace, model, version, replicas, cpu_req_m, mem_req_mib) { Object.assign(this, { name, namespace, model, version, replicas, cpu_req_m, mem_req_mib }); }
  desired_pod_names() { return Array.from({ length: this.replicas }, (_, i) => `${this.name}-${i}`); }
  spec_dict() { return { name: this.name, namespace: this.namespace, model: this.model, declared_version: this.version, replicas: this.replicas, cpu_req_m: this.cpu_req_m, mem_req_mib: this.mem_req_mib }; }
};
deep.EndpointPod = class { constructor(name, version, cpu_req_m, mem_req_mib) { Object.assign(this, { name, version, cpu_req_m, mem_req_mib }); this.status = 'Running'; } };
deep.Controller = class {
  constructor(endpoint) { this.endpoint = endpoint; this.pods = new Map(); this.action_log = []; this.version_log = []; this.pass_count = 0; }
  _log(action, pod, from_version, to_version) { this.action_log.push({ seq: this.action_log.length + 1, pass: this.pass_count, action, pod, from_version, to_version }); }
  set_version(v) { const old = this.endpoint.version; this.endpoint.version = v; this.version_log.push({ endpoint: this.endpoint.name, from_version: old, to_version: v }); }
  reconcile() {
    this.pass_count += 1; const before = this.action_log.length; const ep = this.endpoint; const desired = ep.desired_pod_names();
    for (const name of desired) {
      const pod = this.pods.get(name);
      if (pod === undefined) { this.pods.set(name, new deep.EndpointPod(name, ep.version, ep.cpu_req_m, ep.mem_req_mib)); this._log('create', name, null, ep.version); }
      else if (pod.version !== ep.version) { const old = pod.version; this.pods.set(name, new deep.EndpointPod(name, ep.version, ep.cpu_req_m, ep.mem_req_mib)); this._log('replace', name, old, ep.version); }
    }
    for (const name of sortedKeys(this.pods)) if (!desired.includes(name)) { const old = this.pods.get(name).version; this.pods.delete(name); this._log('delete', name, old, null); }
    return this.action_log.slice(before);
  }
  live_state() { return sortedKeys(this.pods).map((n) => { const p = this.pods.get(n); return { name: p.name, version: p.version, status: p.status, cpu_req_m: p.cpu_req_m, mem_req_mib: p.mem_req_mib }; }); }
  healthy() {
    const ep = this.endpoint, desired = ep.desired_pod_names();
    if (this.pods.size !== ep.replicas) return false;
    const sameSet = this.pods.size === desired.length && desired.every((n) => this.pods.has(n));
    return desired.filter((n) => this.pods.has(n)).every((n) => this.pods.get(n).version === ep.version && this.pods.get(n).status === 'Running') && sameSet;
  }
};

deep.DrillNode = class { constructor(name, kubelet_version, ready = true) { Object.assign(this, { name, kubelet_version, ready }); } };
deep.ClusterUpgrade = class {
  constructor(cp, nodes, target, endpoint_healthy) { this.control_plane_version = cp; this.nodes = new Map(nodes.map((n) => [n.name, n])); this.target_version = target; this.endpoint_healthy = endpoint_healthy; }
  run_upgrade() {
    const start = this.control_plane_version, target = this.target_version, names = sortedKeys(this.nodes);
    const pre_checks = [
      { name: 'control plane at start version', pass: this.control_plane_version === start },
      { name: 'all nodes Ready', pass: names.every((n) => this.nodes.get(n).ready) },
      { name: 'kubelet skew within one minor', pass: names.every((n) => this.nodes.get(n).kubelet_version === start) },
      { name: 'endpoint healthy before upgrade', pass: this.endpoint_healthy },
    ];
    const steps = ['pre-checks complete', 'backup etcd snapshot (simulated)', `upgrade control plane cp-0 from ${start} to ${target}`, `upgrade kubelet on cp-0 from ${start} to ${target}`];
    this.control_plane_version = target; this.nodes.get('cp-0').kubelet_version = target;
    for (const w of ['worker-0', 'worker-1']) {
      steps.push(`drain ${w}`, `upgrade kubelet on ${w} from ${start} to ${target}`); this.nodes.get(w).kubelet_version = target; steps.push(`uncordon ${w}`);
    }
    steps.push('post-checks complete');
    const post_checks = [
      { name: 'control plane at target version', pass: this.control_plane_version === target },
      { name: 'all kubelets at target version', pass: names.every((n) => this.nodes.get(n).kubelet_version === target) },
      { name: 'all nodes Ready', pass: names.every((n) => this.nodes.get(n).ready) },
      { name: 'endpoint still healthy', pass: this.endpoint_healthy },
    ];
    const allPass = pre_checks.every((c) => c.pass) && post_checks.every((c) => c.pass);
    return {
      simulated: true, from_version: start, to_version: target, pre_checks, steps, post_checks, rollback_triggered: false,
      rollback_note: `No rollback was needed: every post-check passed. If a post-check had failed, the simulated rollback would restore the etcd snapshot taken in step 2, return the control plane to ${start}, and re-run the pre-checks before any second attempt. This note describes the simulated procedure only; no real rollback was performed.`,
      status: allPass ? 'Succeeded' : 'Failed',
      final_control_plane_version: this.control_plane_version,
      final_kubelet_versions: Object.fromEntries(names.map((n) => [n, this.nodes.get(n).kubelet_version])),
    };
  }
};

// cost_model() with its fixed inputs exposed as arguments; the defaults are the Python constants.
export function costModel(nodes = 3, per_node = 40, storage = 10) {
  const node_total = nodes * per_node;
  return {
    label: 'modelled, illustrative only - not real cloud prices and not real spend',
    assumptions: { nodes, modelled_usd_per_node_per_month: per_node, modelled_storage_usd_per_month: storage, endpoint_pods_share_node_cost: true },
    node_cost_usd_per_month: node_total, storage_cost_usd_per_month: storage, total_modelled_usd_per_month: node_total + storage,
  };
}

export const drillNodes = () => [new deep.DrillNode('cp-0', '1.29'), new deep.DrillNode('worker-0', '1.29'), new deep.DrillNode('worker-1', '1.29')];
export const newEndpoint = () => new deep.ModelEndpoint('chat-endpoint', 'team-serve', 'tiny-gpt', 'v1', 3, 500, 1024);

// The run_deep.py operator steps, as replayable ops for the stepper.
export const DEEP_SCRIPT = [
  { op: 'reconcile' }, { op: 'reconcile' }, { op: 'version', v: 'v2' }, { op: 'reconcile' },
  { op: 'delete', pod: 'chat-endpoint-1' }, { op: 'tamper', pod: 'chat-endpoint-2', v: 'v1' }, { op: 'extra', pod: 'chat-endpoint-99' }, { op: 'reconcile' },
];
// Applies stepper ops to a fresh controller. Drift ops (delete, tamper, extra) act outside the controller, as in run_deep.py.
export function applyDeep(ops) {
  const ctl = new deep.Controller(newEndpoint()); const passes = [];
  for (const o of ops) {
    if (o.op === 'reconcile') passes.push(ctl.reconcile());
    else if (o.op === 'version') ctl.set_version(o.v);
    else if (o.op === 'replicas') ctl.endpoint.replicas = o.n;
    else if (o.op === 'delete') ctl.pods.delete(o.pod);
    else if (o.op === 'tamper') { const p = ctl.pods.get(o.pod); if (p) p.version = o.v; }
    else if (o.op === 'extra') ctl.pods.set(o.pod, new deep.EndpointPod(o.pod, ctl.endpoint.version, ctl.endpoint.cpu_req_m, ctl.endpoint.mem_req_mib));
  }
  return { ctl, passes };
}

const countActs = (acts) => { const out = { create: 0, replace: 0, delete: 0 }; for (const a of acts) out[a.action] += 1; return out; };
export { countActs };

export function replayDeep() {
  const ep = newEndpoint(); const ctl = new deep.Controller(ep);
  const pass1 = ctl.reconcile(); const state_after_pass1 = ctl.live_state();
  const pass2 = ctl.reconcile(); ctl.set_version('v2');
  const pass3 = ctl.reconcile(); const state_after_pass3 = ctl.live_state();
  ctl.pods.delete('chat-endpoint-1'); ctl.pods.get('chat-endpoint-2').version = 'v1';
  ctl.pods.set('chat-endpoint-99', new deep.EndpointPod('chat-endpoint-99', 'v2', 500, 1024));
  const state_before_pass4 = ctl.live_state();
  const pass4 = ctl.reconcile(); const final_pods = ctl.live_state();
  const upgrade = new deep.ClusterUpgrade('1.29', drillNodes(), '1.30', ctl.healthy()).run_upgrade();
  const total = countActs(ctl.action_log); const running = final_pods.filter((p) => p.status === 'Running');
  const cm = costModel();
  return {
    endpoint_spec: ep.spec_dict(),
    pass_actions: { pass1, pass2, pass3, pass4 },
    action_counts_by_pass: { pass1: countActs(pass1), pass2: countActs(pass2), pass3: countActs(pass3), pass4: countActs(pass4) },
    state_after_pass1, state_after_pass3, state_before_pass4,
    version_upgrade_log: ctl.version_log, action_log: ctl.action_log, final_pods,
    endpoint_healthy_final: ctl.healthy(), cluster_upgrade: upgrade, cost_model: cm,
    summary: {
      reconcile_passes: ctl.pass_count, total_actions: ctl.action_log.length, creates: total.create, replaces: total.replace, deletes: total.delete,
      version_log_entries: ctl.version_log.length, final_declared_version: ep.version, final_pods: final_pods.length,
      final_pods_at_declared: final_pods.filter((p) => p.version === ep.version).length,
      final_running_cpu_m: running.reduce((s, p) => s + p.cpu_req_m, 0), final_running_mem_mib: running.reduce((s, p) => s + p.mem_req_mib, 0),
      cluster_from_version: upgrade.from_version, cluster_to_version: upgrade.to_version, cluster_upgrade_steps: upgrade.steps.length,
      cluster_pre_checks_passed: upgrade.pre_checks.filter((c) => c.pass).length, cluster_post_checks_passed: upgrade.post_checks.filter((c) => c.pass).length,
      rollback_triggered: upgrade.rollback_triggered, modelled_total_usd_per_month: cm.total_modelled_usd_per_month,
    },
  };
}

/* ============================ Invariant fuzzer (new, not a repo result) ============================ */
// Small seeded PRNG (mulberry32) so a run is repeatable from its seed.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

// Runs random operation sequences through the three ports and counts invariant checks.
export function fuzz({ runs = 200, steps = 25, seed = 20 } = {}) {
  const r = rng(seed);
  const inv = {
    nodeCapacity: { label: 'No node over-committed (cpu, memory, GPU devices)', checks: 0, violations: 0 },
    quota: { label: 'Namespace quota never exceeded by active pods', checks: 0, violations: 0 },
    placementRules: { label: 'Every Running pod meets its nodeSelector and tolerates node taints', checks: 0, violations: 0 },
    converge: { label: 'One reconcile after drift reaches healthy(), all pods at the declared version', checks: 0, violations: 0 },
    idempotent: { label: 'A reconcile right after convergence takes 0 actions', checks: 0, violations: 0 },
  };
  const tick = (k, ok) => { inv[k].checks += 1; if (!ok) inv[k].violations += 1; };
  for (let run = 0; run < runs; run++) {
    // Learn: random creates, deletes, scales, reconciles.
    const lc = new learn.Cluster();
    for (const [n, cpu, mem] of LEARN_NODES) lc.add_node(new learn.Node(n, cpu, mem));
    lc.add_configmap(new learn.ConfigMap('api-config', LEARN_CONFIG));
    lc.apply_deployment(new learn.Deployment('api', 2, { app: 'api' }, 500, 512, 'api-config'));
    lc.apply_deployment(new learn.Deployment('worker', 1, { app: 'worker' }, 1000, 1024));
    // Build: random admissions into the Build scenario's nodes and namespaces.
    const bc = buildScenario('admission').cluster;
    const ctl = new deep.Controller(new deep.ModelEndpoint('ep', 'ns', 'm', 'v1', r.int(1, 6), 500, 1024)); ctl.reconcile();
    for (let s = 0; s < steps; s++) {
      const op = r.int(0, 4);
      if (op === 0) lc.create_pod(`p-${run}-${s}`, { app: 'x' }, r.int(2, 180) * 50, r.int(1, 280) * 64);
      else if (op === 1) { const live = [...lc.pods.values()].filter((p) => p.status !== 'Deleted').map((p) => p.name); if (live.length) lc.delete_pod(r.pick(live)); }
      else if (op === 2) lc.scale(r.pick(['api', 'worker']), r.int(0, 7));
      else lc.reconcile(r.pick(['api', 'worker']));
      for (const [n, node] of lc.nodes) { const u = lc.node_usage(n); tick('nodeCapacity', u.cpu_m <= node.cpu_m && u.mem_mib <= node.mem_mib); }

      const cpu = r.int(1, 90) * 100, mem = r.int(1, 140) * 128;
      bc.admit(new build.Pod(`f-${run}-${s}`, r.pick(['team-train', 'team-serve', 'team-sandbox']), { app: 'f' }, cpu, cpu + r.int(-2, 20) * 100, mem, mem + r.int(-2, 32) * 128,
        { gpu: r.int(0, 3), node_selector: r.next() < 0.4 ? GPU_SEL : null, tolerations: r.next() < 0.5 ? GPU_TOL() : null }));
      for (const [n, node] of bc.nodes) { const u = bc.node_usage(n); tick('nodeCapacity', u.cpu_m <= node.cpu_m && u.mem_mib <= node.mem_mib && u.gpu <= node.gpu); }
      for (const [n, ns] of bc.namespaces) { const q = bc.quota_usage(n); tick('quota', ['cpu_m', 'mem_mib', 'gpu', 'pods'].every((k) => q[k] <= ns.quota[k])); }
      for (const p of bc.pods.values()) if (p.status === 'Running') {
        const node = bc.nodes.get(p.node);
        tick('placementRules', Object.entries(p.node_selector).every(([k, v]) => node.labels[k] === v) && node.taints.every((t) => t.effect !== 'NoSchedule' || p.tolerations.some((tol) => tol.tolerates(t))));
      }

      const names = sortedKeys(ctl.pods), d = r.int(0, 5);
      if (d === 0 && names.length) ctl.pods.delete(r.pick(names));
      else if (d === 1 && names.length) ctl.pods.get(r.pick(names)).version = r.pick(['v1', 'v2', 'v3']);
      else if (d === 2) { const x = `ep-${r.int(5, 99)}`; ctl.pods.set(x, new deep.EndpointPod(x, r.pick(['v1', 'v2', 'v3']), 500, 1024)); }
      else if (d === 3) ctl.set_version(r.pick(['v1', 'v2', 'v3']));
      else ctl.endpoint.replicas = r.int(0, 6);
      if (r.next() < 0.5) {
        ctl.reconcile();
        tick('converge', ctl.healthy() && [...ctl.pods.values()].every((p) => p.version === ctl.endpoint.version));
        tick('idempotent', ctl.reconcile().length === 0);
      }
    }
  }
  return Object.values(inv);
}
