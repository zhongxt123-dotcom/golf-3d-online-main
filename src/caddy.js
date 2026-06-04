// 数字球童模块：维护球童模式、基础结构化输出和本地/云端大模型调用。
export const CADDY_MODE_CONFIG = {
  strategy: {
    label: "球场攻略",
    task: "路线管理、保守/进攻策略、风险区提醒",
    actionTitle: "路线打法",
  },
  club: {
    label: "选杆建议",
    task: "基于开球距离、常见失误、球场类型给出一号木、木杆、铁杆和挖起杆策略",
    actionTitle: "选杆策略",
  },
  fix: {
    label: "失误修正",
    task: "根据右曲、左拉、短杆薄弱、推杆不稳等常见失误给出本场修正建议",
    actionTitle: "修正动作",
  },
  routine: {
    label: "赛前清单",
    task: "热身、补水、防晒、球具检查、练习果岭和节奏管理",
    actionTitle: "赛前清单",
  },
  training: {
    label: "训练计划",
    task: "赛前 30 分钟、赛前 7 天、长期训练建议",
    actionTitle: "训练安排",
  },
  mental: {
    label: "心理球童",
    task: "落后、连续失误、关键洞前如何调整心态和节奏",
    actionTitle: "心理节奏",
  },
  bag: {
    label: "球包配置",
    task: "让用户填写常用球杆，按球杆距离给出本场球包和落点建议",
    actionTitle: "球包策略",
  },
};

const CADDY_MODEL_KEY = "golf-caddy-model";
const DEFAULT_CADDY_MODEL = "qwen3:8b";
const DEFAULT_LOCAL_CADDY_BASE = "http://localhost:11434/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

export function buildCaddySections({
  judgment,
  action,
  risk,
  next,
  club,
  choice,
  warmup,
  reminder,
}) {
  return [
    `【今日策略】${judgment}`,
    `【主要风险】${risk}`,
    `【选杆建议】${club || action}`,
    `【进攻/保守选择】${choice || action}`,
    `【训练或热身建议】${warmup || next}`,
    `【一句话提醒】${reminder || next}`,
  ].join("\n");
}

export function normalizeCaddyMode(mode = "basic") {
  return ["auto", "local", "cloud", "basic"].includes(mode) ? mode : "basic";
}

export function normalizeApiBase(base, fallback) {
  return String(base || fallback).replace(/\/+$/, "");
}

export function isGithubPagesStaticHost(locationRef = window.location) {
  return locationRef.hostname.endsWith(".github.io");
}

export function isLocalDevelopmentHost(locationRef = window.location) {
  return ["localhost", "127.0.0.1", "::1"].includes(locationRef.hostname);
}

export function isRelativeEndpoint(endpoint) {
  return String(endpoint || "").startsWith("/");
}

export function getCaddyModeLabel(mode) {
  if (mode === "local") return "本地大模型";
  if (mode === "cloud") return "云端球童";
  if (mode === "cloud-unconfigured") return "云端未配置";
  if (mode === "auto") return "自动模式";
  return "基础模式";
}

async function fetchJsonWithTimeout(fetchImpl, url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export function createCaddyRuntime({
  appConfig,
  buildPrompt,
  getFallbackAdvice,
  getProfile,
  setStatus = () => {},
  fetchImpl = window.fetch.bind(window),
  storage = window.localStorage,
  locationRef = window.location,
} = {}) {
  let detectedCaddyModel = null;
  let modelDetectionStarted = false;
  let localCaddyUnavailableReason = "";
  const getRequestTimeout = () => {
    const timeout = Number(appConfig?.requestTimeoutMs);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_REQUEST_TIMEOUT_MS;
  };
  const getCloudEndpoint = () => String(appConfig?.cloudEndpoint || "").trim();

  const getConfiguredMode = () => normalizeCaddyMode(appConfig?.caddyMode);
  const getPreferredLocalModel = () => String(appConfig?.localModel || storage.getItem(CADDY_MODEL_KEY) || DEFAULT_CADDY_MODEL).trim();

  function getExecutionPlan() {
    const configuredMode = getConfiguredMode();
    const endpoint = getCloudEndpoint();
    const cloudConfigured = Boolean(endpoint);
    const cloudUsableHere = cloudConfigured && !(isGithubPagesStaticHost(locationRef) && isRelativeEndpoint(endpoint));

    if (configuredMode === "basic") {
      return { configuredMode, requestMode: "basic", statusMode: "basic", detail: "规则建议" };
    }

    if (configuredMode === "cloud") {
      return cloudUsableHere
        ? { configuredMode, requestMode: "cloud", statusMode: "cloud", detail: "准备连接" }
        : { configuredMode, requestMode: "cloud-unconfigured", statusMode: "cloud", detail: "云端未配置" };
    }

    if (configuredMode === "local") {
      if (isGithubPagesStaticHost(locationRef)) {
        return { configuredMode, requestMode: "local-blocked", statusMode: "basic", detail: "线上不调用 localhost" };
      }
      return { configuredMode, requestMode: "local", statusMode: "local", detail: "等待连接" };
    }

    if (isGithubPagesStaticHost(locationRef)) {
      return cloudUsableHere
        ? { configuredMode, requestMode: "cloud", statusMode: "cloud", detail: "自动选择云端" }
        : { configuredMode, requestMode: "cloud-unconfigured", statusMode: "cloud", detail: "云端未配置" };
    }

    if (isLocalDevelopmentHost(locationRef)) {
      return { configuredMode, requestMode: "local", statusMode: "local", detail: "自动尝试本地 Ollama" };
    }

    return cloudUsableHere
      ? { configuredMode, requestMode: "cloud", statusMode: "cloud", detail: "自动选择云端" }
      : { configuredMode, requestMode: "basic", statusMode: "basic", detail: "规则建议" };
  }

  async function resolveCaddyModel() {
    if (detectedCaddyModel !== null) return detectedCaddyModel;
    if (modelDetectionStarted) return null;
    if (getExecutionPlan().requestMode !== "local") return null;
    if (isGithubPagesStaticHost(locationRef)) return null;

    modelDetectionStarted = true;
    try {
      const localBaseUrl = normalizeApiBase(appConfig?.localBaseUrl, DEFAULT_LOCAL_CADDY_BASE);
      const preferred = getPreferredLocalModel();
      const body = await fetchJsonWithTimeout(fetchImpl, `${localBaseUrl}/models`, {}, Math.min(getRequestTimeout(), 3000));
      const models = Array.isArray(body.data) ? body.data.map((m) => m.id).filter(Boolean) : [];
      if (!models.length) {
        detectedCaddyModel = null;
        localCaddyUnavailableReason = "本地 Ollama 未安装模型";
        return null;
      }
      detectedCaddyModel = models.includes(preferred) ? preferred : models[0] || null;
      localCaddyUnavailableReason = "";
      return detectedCaddyModel;
    } catch {
      detectedCaddyModel = null;
      localCaddyUnavailableReason = "本地 Ollama 未连接";
      return null;
    } finally {
      modelDetectionStarted = false;
    }
  }

  async function getAdviceFromLLM(loc, mode = "strategy", note = "") {
    const fallback = getFallbackAdvice(loc, mode, note);
    const plan = getExecutionPlan();
    const friendlyFallback = `${fallback}\n【来源】当前使用基础球童建议。如需 AI 深度分析，请配置本地 Ollama 或云端球童服务。`;

    if (plan.requestMode === "basic") {
      setStatus("basic", "规则建议");
      return friendlyFallback;
    }

    if (plan.requestMode === "cloud-unconfigured") {
      setStatus("cloud", "云端未配置");
      return `${fallback}\n【来源】云端球童服务未配置。GitHub Pages 不能调用开发者本机 Ollama，请部署 /api/caddy 或填写外部后端地址。`;
    }

    if (plan.requestMode === "cloud") {
      const endpoint = getCloudEndpoint();

      try {
        setStatus("cloud", "分析中");
        const body = await fetchJsonWithTimeout(fetchImpl, endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            note,
            prompt: buildPrompt(loc, mode, note),
            course: {
              id: loc.id,
              name: loc.name,
              province: loc.province,
              city: loc.city,
              difficulty: loc.difficulty,
              courseType: loc.courseType,
              hazards: loc.hazards,
            },
            profile: getProfile?.(),
          }),
        }, getRequestTimeout());
        const content = body?.advice || body?.content || body?.choices?.[0]?.message?.content;
        setStatus("cloud", "已连接");
        return String(content || fallback).trim();
      } catch {
        setStatus("basic", "云端不可用，已回退");
        return friendlyFallback;
      }
    }

    if (plan.requestMode === "local-blocked") {
      setStatus("basic", "线上不调用 localhost");
      return `${fallback}\n【来源】GitHub Pages 环境不会调用开发者本机 Ollama，已切换基础模式。`;
    }

    const model = await resolveCaddyModel();

    if (!model) {
      const reason = localCaddyUnavailableReason || "本地 Ollama 未连接";
      setStatus("basic", reason);
      return friendlyFallback;
    }

    try {
      setStatus("local", `使用 ${model} · 首次加载可能较慢`);
      const localBaseUrl = normalizeApiBase(appConfig?.localBaseUrl, DEFAULT_LOCAL_CADDY_BASE);
      const body = await fetchJsonWithTimeout(fetchImpl, `${localBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.72,
          max_tokens: 760,
          messages: [
            { role: "system", content: "你只输出中文高尔夫球童建议，不输出推理过程。语气专业、具体、像真人球童。输出必须严格使用【今日策略】【主要风险】【选杆建议】【进攻/保守选择】【训练或热身建议】【一句话提醒】六段，每段 1-2 句，不要泛泛而谈。" },
            { role: "user", content: buildPrompt(loc, mode, note) },
          ],
        }),
      }, Math.max(getRequestTimeout(), 45000));
      const content = body?.choices?.[0]?.message?.content?.trim();
      setStatus("local", `使用 ${model}`);
      return content || fallback;
    } catch {
      setStatus("basic", "本地大模型未响应");
      return friendlyFallback;
    }
  }

  return {
    getConfiguredMode,
    getExecutionPlan,
    getAdviceFromLLM,
    resolveCaddyModel,
  };
}

export function initCaddyModule() {
  return {
    responsibility: "数字球童、本地 Ollama、云端接口和基础建议运行时",
    modeConfig: CADDY_MODE_CONFIG,
    createCaddyRuntime,
  };
}
