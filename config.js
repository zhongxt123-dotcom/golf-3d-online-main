// 前端公开配置：不要在这里写入真实 API Key，正式上线请通过后端代理大模型服务。
export const APP_CONFIG = {
  caddyMode: "auto", // "auto" | "local" | "cloud" | "basic"
  localBaseUrl: "http://localhost:11434/v1",
  localModel: "qwen3:8b",
  cloudEndpoint: "",
  requestTimeoutMs: 12000,
  weatherMode: "amap",
  amapWeatherKey: "4e6c55d6546172d8e63b0238d5b7b78a",
};

// 兼容旧模块引用，后续可逐步统一改为 APP_CONFIG。
export const appConfig = APP_CONFIG;
