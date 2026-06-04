// 天气风险模块：提供 mock 天气、高德天气占位和数字球童可读的天气摘要。
import { appConfig } from "../config.js";

const WEATHER_MODE_LABELS = {
  mock: "mockWeather",
  amap: "amapWeather",
  disabled: "disabled",
};

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRegionalBaseline(course = {}) {
  const text = `${course.province || ""} ${course.city || ""} ${course.name || ""}`;
  if (/海南|广东|广西|福建|三亚|海口|深圳|广州|厦门/.test(text)) {
    return { temperature: 32, humidity: 78, windLevel: 3, rainChance: 0.45, condition: "湿热多云" };
  }
  if (/重庆|武汉|长沙|南京|杭州|上海|苏州|无锡/.test(text)) {
    return { temperature: 31, humidity: 74, windLevel: 2, rainChance: 0.34, condition: "闷热多云" };
  }
  if (/新疆|内蒙古|宁夏|甘肃|河西|荒漠|戈壁/.test(text)) {
    return { temperature: 28, humidity: 34, windLevel: 5, rainChance: 0.12, condition: "干燥有风" };
  }
  if (/云南|昆明|丽江|大理|贵阳|贵州/.test(text)) {
    return { temperature: 24, humidity: 58, windLevel: 3, rainChance: 0.28, condition: "高原多云" };
  }
  if (/北京|天津|河北|山东|青岛|大连|辽宁/.test(text)) {
    return { temperature: 27, humidity: 52, windLevel: 4, rainChance: 0.22, condition: "晴间多云" };
  }
  return { temperature: 29, humidity: 62, windLevel: 3, rainChance: 0.25, condition: "多云" };
}

function getRainfallLabel(hasRain, seed) {
  if (!hasRain) return "无明显降雨";
  return seed % 3 === 0 ? "阵雨" : seed % 3 === 1 ? "小雨" : "雷阵雨风险";
}

export function getWeatherRisk(weather = {}) {
  if (!weather || !weather.available) {
    return {
      riskLevel: "未知",
      riskTips: [],
    };
  }

  const riskTips = [];
  if (weather.temperature >= 35) {
    riskTips.push("高温风险：补水、防晒，减少前九洞体能消耗。");
  }
  if (weather.windLevel >= 5) {
    riskTips.push("风力偏强：压低弹道，保守选择落点，避免高抛球硬攻。");
  }
  if (weather.rainfall && weather.rainfall !== "无明显降雨") {
    riskTips.push("降雨影响：检查鞋钉和手套防滑，果岭速度可能变慢。");
  }
  if (weather.humidity >= 75) {
    riskTips.push("湿度偏高：控制挥杆节奏，备手套和毛巾，分段补水。");
  }
  if (weather.temperature <= 12) {
    riskTips.push("低温提醒：热身时间加长，球距可能略短，前几洞避免强攻。");
  }
  if (!riskTips.length) {
    riskTips.push("天气风险较低：按正常热身节奏准备，临场确认风向和果岭速度。");
  }

  const riskLevel = weather.temperature >= 35
    || weather.windLevel >= 6
    || ((weather.rainfall && weather.rainfall !== "无明显降雨") && weather.windLevel >= 5)
    ? "高"
    : riskTips.length >= 2 || weather.windLevel >= 5 || weather.humidity >= 75
      || (weather.rainfall && weather.rainfall !== "无明显降雨")
      ? "中"
      : "低";

  return { riskLevel, riskTips };
}

export function getMockWeather(course = {}) {
  const seed = hashText(`${course.province || ""}-${course.city || ""}-${course.name || ""}-${course.lat || ""}-${course.lng || ""}`);
  const base = getRegionalBaseline(course);
  const temperature = clamp(Math.round(base.temperature + (seed % 9) - 4), 8, 38);
  const windLevel = clamp(Math.round(base.windLevel + ((seed >> 3) % 5) - 2), 1, 7);
  const humidity = clamp(Math.round(base.humidity + ((seed >> 6) % 23) - 10), 28, 92);
  const hasRain = ((seed % 100) / 100) < base.rainChance || humidity >= 86;
  const rainfall = getRainfallLabel(hasRain, seed);
  const condition = hasRain ? rainfall : base.condition;
  const baseWeather = {
    mode: "mockWeather",
    source: "本地模拟天气",
    available: true,
    city: course.city || course.province || "球场所在地",
    condition,
    temperature,
    windLevel,
    humidity,
    rainfall,
    updatedAt: "模拟数据",
  };
  const risk = getWeatherRisk(baseWeather);
  const weather = {
    ...baseWeather,
    ...risk,
  };
  return {
    ...weather,
    risks: risk.riskTips,
    summary: `${condition} · ${temperature}°C · ${windLevel}级风 · 湿度${humidity}%`,
    caddyBrief: formatWeatherForCaddy(weather),
  };
}

function parseWindLevel(windPower) {
  if (!windPower) return 0;
  const numMatch = windPower.match(/(\d+)/);
  if (numMatch) return Number(numMatch[1]);
  if (windPower.includes("≤") || windPower.includes("<")) return 3;
  return 2;
}

export async function getAmapWeather(course = {}, config = appConfig) {
  const cityName = course.city || course.province || "";
  const adcode = course.adcode || "";

  if (!adcode) {
    return {
      mode: "amapWeather",
      source: "高德实时天气",
      available: false,
      city: cityName,
      condition: "",
      temperature: 0,
      windLevel: 0,
      windDirection: "",
      windPower: "",
      humidity: 0,
      rainfall: "",
      summary: "天气数据暂不可用",
      riskLevel: "未知",
      riskTips: [],
      risks: [],
      caddyBrief: "",
    };
  }

  const key = config.amapWeatherKey || "";
  if (!key) {
    return {
      mode: "amapWeather",
      source: "高德实时天气",
      available: false,
      city: cityName,
      condition: "",
      temperature: 0,
      windLevel: 0,
      windDirection: "",
      windPower: "",
      humidity: 0,
      rainfall: "",
      summary: "未配置高德天气 Key",
      riskLevel: "未知",
      riskTips: [],
      risks: [],
      caddyBrief: "",
    };
  }

  try {
    const url = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${key}&extensions=base`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "1" || !Array.isArray(data.lives) || !data.lives.length) {
      throw new Error(data.info || "天气接口返回异常");
    }

    const live = data.lives[0];
    const temperature = Number(live.temperature) || 0;
    const humidity = Number(live.humidity) || 0;
    const windLevel = parseWindLevel(live.windpower);
    const condition = live.weather || "未知";
    const windDirection = live.winddirection || "";
    const windPower = live.windpower || "";
    const hasRain = condition.includes("雨");
    const rainfall = hasRain ? condition : "无明显降雨";

    const baseWeather = {
      mode: "amapWeather",
      source: "高德实时天气",
      available: true,
      city: live.city || cityName,
      condition,
      temperature,
      windLevel,
      windDirection,
      windPower,
      humidity,
      rainfall,
      updatedAt: live.reporttime || "",
    };

    const risk = getWeatherRisk(baseWeather);

    return {
      ...baseWeather,
      ...risk,
      risks: risk.riskTips,
      summary: `${condition} · ${temperature}°C · ${windDirection}风${windPower} · 湿度${humidity}%`,
      caddyBrief: formatWeatherForCaddy({ ...baseWeather, ...risk }),
    };
  } catch (error) {
    console.warn("高德天气 API 请求失败：", error);
    return {
      mode: "amapWeather",
      source: "高德实时天气",
      available: false,
      city: cityName,
      condition: "",
      temperature: 0,
      windLevel: 0,
      windDirection: "",
      windPower: "",
      humidity: 0,
      rainfall: "",
      summary: "天气数据暂不可用",
      riskLevel: "未知",
      riskTips: [],
      risks: [],
      caddyBrief: "",
    };
  }
}

export function formatWeatherForCaddy(weather = null) {
  if (!weather?.available) return "";
  const tips = weather.riskTips || weather.risks || [];
  const windText = weather.windDirection
    ? `${weather.windDirection}风${weather.windPower || ""}（约${weather.windLevel || "?"}级）`
    : `${weather.windLevel || "?"}级风`;
  return `天气：${weather.condition || "待确认"}，${weather.temperature}°C，${windText}，湿度${weather.humidity}%，${weather.rainfall || "降雨待确认"}。风险等级${weather.riskLevel}。${tips.join("")}`;
}

export async function getWeatherForCourse(course, config = appConfig) {
  const mode = config.weatherMode || "mock";
  if (mode === "disabled") return null;
  if (mode === "amap") return getAmapWeather(course, config);
  return getMockWeather(course);
}

export const createMockWeather = getMockWeather;
export const getCourseWeather = getWeatherForCourse;

export function getWeatherModeLabel(config = appConfig) {
  return WEATHER_MODE_LABELS[config.weatherMode] || "mockWeather";
}
