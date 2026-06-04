// 应用编排模块：承载现有 3D 高尔夫地图运行逻辑，保持功能和 UI 表现不变。
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { appConfig } from "../config.js";
import { golfLocations } from "../locations.js?v=mobile-marker-bag-20260522";
import { getCourseWeather, getWeatherModeLabel } from "./weather.js";

export function initGolfApp(moduleRegistry = {}) {
  window.__golfModuleRegistry = moduleRegistry;
  function reportPageResourceIssue(title, message, options = {}) {
    if (typeof window.showPageError === "function") {
      window.showPageError(title, message, options);
    } else {
      console.warn(title, message);
    }
  }
  
  // ─── User Profile ─────────────────────────────────────────
  let userProfile = null;
  
  const profileModal = document.getElementById("profile-modal");
  const profileSubmit = document.getElementById("profile-submit");
  const profileReset = document.getElementById("profile-reset");
  const locateNearby = document.getElementById("locate-nearby");
  const overviewOpen = document.getElementById("overview-open");
  const transitionMask = document.getElementById("transition-mask");
  const transitionCopy = document.getElementById("transition-copy");
  const listPanel = document.getElementById("list-panel");
  const listTitle = document.getElementById("list-title");
  const listSubtitle = document.getElementById("list-subtitle");
  const listContent = document.getElementById("list-content");
  const listClose = document.getElementById("list-close");
  const listTools = document.getElementById("list-tools");
  const listSearch = document.getElementById("list-search");
  const listProvinceFilter = document.getElementById("list-province-filter");
  const listTypeFilter = document.getElementById("list-type-filter");
  const listDifficultyFilter = document.getElementById("list-difficulty-filter");
  const listSortFilter = document.getElementById("list-sort-filter");
  const listSuitableFilter = document.getElementById("list-suitable-filter");
  const listVideoFilter = document.getElementById("list-video-filter");
  const listModelFilter = document.getElementById("list-model-filter");
  const listFilterNote = document.getElementById("list-filter-note");
  const listNearbyTools = document.getElementById("list-nearby-tools");
  const nearbyStatus = document.getElementById("nearby-status");
  const nearbyCount = document.getElementById("nearby-count");
  const nearbyDistance = document.getElementById("nearby-distance");
  const nearbyCitySelect = document.getElementById("nearby-city-select");
  const profileScore = document.getElementById("profile-score");
  const profileDrive = document.getElementById("profile-drive");
  const profileMiss = document.getElementById("profile-miss");
  const profileGoal = document.getElementById("profile-goal");
  const mapDetailLayer = document.getElementById("map-detail-layer");
  const detailMapCanvas = document.getElementById("detail-map-canvas");
  const mapDetailTitle = document.getElementById("map-detail-title");
  const mapDetailMeta = document.getElementById("map-detail-meta");
  const mapDetailScale = document.getElementById("map-detail-scale");
  const mapDetailReset = document.getElementById("map-detail-reset");
  const mapDetailClose = document.getElementById("map-detail-close");
  const mapProviderTools = document.getElementById("map-provider-tools");
  const mapRegionPanel = document.getElementById("map-region-panel");
  const mapRegionTitle = document.getElementById("map-region-title");
  const mapRegionMeta = document.getElementById("map-region-meta");
  const mapRegionContent = document.getElementById("map-region-content");
  const mapRegionClose = document.getElementById("map-region-close");
  const radioGroups = ["strategy", "terrain", "environment", "skill"];
  let userLocation = null;
  let userLocationSource = "";
  let selectedCourseIndex = null;
  const NEARBY_CITY_STORAGE_KEY = "golf-nearby-city";
  const CADDY_BAG_STORAGE_KEY = "golf-caddy-bag-v1";
  const DEFAULT_COURSE_MODEL_URL = "./assets/golf_scene.glb";
  const NEARBY_CITIES = [
    { name: "北京", lat: 39.9042, lng: 116.4074 },
    { name: "上海", lat: 31.2304, lng: 121.4737 },
    { name: "广州", lat: 23.1291, lng: 113.2644 },
    { name: "深圳", lat: 22.5431, lng: 114.0579 },
    { name: "重庆", lat: 29.563, lng: 106.5516 },
    { name: "成都", lat: 30.5728, lng: 104.0668 },
    { name: "杭州", lat: 30.2741, lng: 120.1551 },
    { name: "西安", lat: 34.3416, lng: 108.9398 },
    { name: "海口", lat: 20.0442, lng: 110.1999 },
    { name: "三亚", lat: 18.2528, lng: 109.5119 },
    { name: "昆明", lat: 25.0389, lng: 102.7183 },
  ];
  const courseLibraryState = {
    mode: "overview",
    query: "",
    province: "all",
    courseType: "all",
    difficulty: "all",
    suitableOnly: false,
    videoOnly: false,
    modelOnly: false,
    nearbyRange: "300",
    sort: "recommend",
  };
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCompactViewport = () => window.matchMedia("(max-width: 768px)").matches || isTouchDevice;
  const isLowPowerDevice = () => (
    isCompactViewport()
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );
  const getScenePixelRatio = () => Math.min(window.devicePixelRatio || 1, isLowPowerDevice() ? 1.35 : 2);
  const getModelPixelRatio = () => Math.min(window.devicePixelRatio || 1, isLowPowerDevice() ? 1.25 : 2);
  let viewMode = "globe";
  let isTransitioning = false;
  let transitionTimer = null;
  
  function showTransition(text = "正在进入球场") {
    if (!transitionMask) return;
    window.clearTimeout(transitionTimer);
    transitionCopy.textContent = text;
    transitionMask.classList.add("visible");
  }

  function getCourseDisplayName(loc, suffix = "高尔夫球场") {
    const base = typeof loc === "string" ? loc : loc?.name;
    if (!base) return suffix;
    return `${base}.${suffix}`;
  }

  function hideTransition() {
    if (!transitionMask) return;
    transitionMask.classList.remove("visible");
  }
  
  function unlockTransition(delay = 0) {
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      isTransitioning = false;
    }, delay);
  }
  
  function checkProfileComplete() {
    const allChecked = radioGroups.every((name) => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      return checked !== null;
    });
    profileSubmit.disabled = !allChecked;
  }
  
  document.querySelectorAll("#profile-questions input[type=radio]").forEach((radio) => {
    radio.addEventListener("change", checkProfileComplete);
  });
  
  function collectProfile() {
    const nextProfile = {};
    radioGroups.forEach((name) => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      nextProfile[name] = checked.value;
    });
    nextProfile.scoreRange = profileScore.value;
    nextProfile.driveDistance = profileDrive.value;
    nextProfile.missTendency = profileMiss.value;
    nextProfile.goal = profileGoal.value.trim() || "未填写";
    return nextProfile;
  }
  
  function showProfileModal({ reset = false } = {}) {
    hideOverlay();
    if (reset) {
      userProfile = null;
      document.querySelectorAll("#profile-questions input[type=radio]").forEach((radio) => {
        radio.checked = false;
      });
      profileScore.value = "未填写";
      profileDrive.value = "未填写";
      profileMiss.value = "未填写";
      profileGoal.value = "";
      profileSubmit.disabled = true;
    }
    profileSubmit.textContent = userProfile ? "更新专属数字球童" : "生成专属数字球童";
    hydrateCaddyBagInputs();
    profileModal.classList.remove("hidden");
  }
  
  profileSubmit.addEventListener("click", () => {
    userProfile = collectProfile();
    hydrateCaddyBagInputs();
    profileModal.classList.add("hidden");
    scanAllCourses();
    if (userLocation) renderCourseList("nearby");
  });
  
  profileReset.addEventListener("click", () => {
    showProfileModal({ reset: true });
  });
  
  // ─── Matching Engine v3.0 ───────────────────────────────────
  const LEVEL_MAP = { "新手上路": 1, "业余高手": 2, "职业水准": 3 };
  const COURSE_DIFFICULTY_MAP = {
    "新手友好": 1,
    "中等": 2,
    "挑战": 3,
    "锦标赛": 4,
    "新手上路": 1,
    "业余高手": 2,
    "职业水准": 3,
  };
  
  function calculateMatch(user, course) {
    const t = course.tags;
    let totalScore = 15;
    let terrainMatch = false;
    let strategyMatch = false;
    let environmentMatch = false;
  
    if (user.terrain === t.terrain) { totalScore += 35; terrainMatch = true; }
    if (user.strategy === t.strategy) { totalScore += 30; strategyMatch = true; }
    if (user.environment === t.environment) { totalScore += 20; environmentMatch = true; }
  
    const userLv = LEVEL_MAP[user.skill];
    const courseLv = LEVEL_MAP[t.skill];
    const isHighRisk = userLv < courseLv;
  
    if (isHighRisk) { totalScore -= 40; }
  
    const finalScore = Math.max(15, totalScore);
  
    return { finalScore, isHighRisk, terrainMatch, strategyMatch, environmentMatch, t, user };
  }
  
  function distanceKm(a, b) {
    const toRad = THREE.MathUtils.degToRad;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  
  function getCourseDistance(loc) {
    if (!userLocation) return null;
    return distanceKm(userLocation, loc);
  }
  
  function formatDistance(km) {
    if (km === null) return "";
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
  }
  
  function getProfileSummary() {
    if (!userProfile) return "尚未建立档案";
    return [
      userProfile.strategy,
      userProfile.terrain,
      userProfile.environment,
      userProfile.skill,
      userProfile.scoreRange !== "未填写" ? `平均${userProfile.scoreRange}` : null,
      userProfile.driveDistance !== "未填写" ? `开球${userProfile.driveDistance}` : null,
      userProfile.missTendency !== "未填写" ? `常见失误：${userProfile.missTendency}` : null,
      userProfile.goal !== "未填写" ? `目标：${userProfile.goal}` : null,
    ].filter(Boolean).join("，");
  }
  
  // ─── Match dimension description ────────────────────────────
  function describeMatches(m) {
    const parts = [];
    if (m.terrainMatch) parts.push(`「${m.t.terrain}」地形`);
    if (m.strategyMatch) parts.push(`「${m.t.strategy}」风格`);
    if (m.environmentMatch) parts.push(`「${m.t.environment}」条件`);
    if (parts.length === 0) return "综合";
    return parts.join("和");
  }

  const CADDY_MODE_CONFIG = {
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

  function buildCaddySections({ judgment, action, risk, next }) {
    return [
      `【判断】${judgment}`,
      `【执行】${action}`,
      `【风险】${risk}`,
      `【下一步】${next}`,
    ].join("\n");
  }

  function getCaddyContext(loc, note = "") {
    const match = calculateMatch(userProfile, loc);
    const distance = formatDistance(getCourseDistance(loc));
    const hazardsText = formatList(loc.hazards);
    const bestForText = formatList(loc.bestFor);
    const miss = userProfile.missTendency !== "未填写" ? userProfile.missTendency : "主要失误";
    const drive = userProfile.driveDistance !== "未填写" ? userProfile.driveDistance : "常规开球距离";
    const score = userProfile.scoreRange !== "未填写" ? userProfile.scoreRange : "未填写";
    const goal = userProfile.goal !== "未填写" ? userProfile.goal : "稳定完赛";
    const weatherText = getWeatherAdviceText();
    const bagProfile = getCaddyBagProfile();
    const noteText = note ? `现场补充：${note}。` : "";
    return {
      match,
      pct: match.finalScore,
      distance,
      distanceText: distance ? `距离你约 ${distance}，` : "",
      hazardsText,
      bestForText,
      miss,
      drive,
      score,
      goal,
      weatherText,
      bagText: bagProfile.text,
      bagSaved: bagProfile.saved,
      bagEstimated: bagProfile.estimated,
      bagData: bagProfile.data,
      noteText,
      courseType: loc.courseType || loc.tags.terrain,
      difficulty: loc.difficulty || loc.tags.skill,
      greenSpeedText: loc.greenSpeed && loc.greenSpeed !== "待确认" ? `果岭速度 ${loc.greenSpeed}` : "果岭速度待确认",
    };
  }

  const BAG_CLUB_LABELS = {
    driver: "Driver",
    wood3: "3W",
    wood5: "5W",
    hybrid: "Hybrid",
    i5: "5i",
    i6: "6i",
    i7: "7i",
    i8: "8i",
    i9: "9i",
    pw: "PW",
    aw: "AW",
    sw: "SW",
    putter: "Putter",
  };

  function getEstimatedDriverDistance() {
    const drive = userProfile?.driveDistance || "未填写";
    if (drive.includes("180码以内")) return 170;
    if (drive.includes("180-220")) return 200;
    if (drive.includes("220-260")) return 240;
    if (drive.includes("260")) return 275;
    return 220;
  }

  function estimateGolfBagFromDrive() {
    const driver = getEstimatedDriverDistance();
    const clampYard = (value) => Math.max(25, Math.round(value));
    return {
      driver,
      wood3: clampYard(driver - 25),
      wood5: clampYard(driver - 40),
      hybrid: clampYard(driver - 55),
      i5: clampYard(driver - 70),
      i6: clampYard(driver - 82),
      i7: clampYard(driver - 95),
      i8: clampYard(driver - 108),
      i9: clampYard(driver - 120),
      pw: clampYard(driver - 135),
      aw: clampYard(driver - 150),
      sw: clampYard(driver - 168),
      putter: "",
    };
  }

  function readSavedCaddyBag() {
    try {
      const raw = localStorage.getItem(CADDY_BAG_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function normalizeBagData(data = {}) {
    return Object.fromEntries(Object.keys(BAG_CLUB_LABELS).map((key) => {
      const value = data[key];
      if (key === "putter") return [key, typeof value === "string" ? value.trim() : ""];
      const number = Number(value);
      return [key, Number.isFinite(number) && number > 0 ? Math.round(number) : ""];
    }));
  }

  function hasCaddyBagValues(data) {
    return Object.entries(data || {}).some(([key, value]) => key === "putter" ? Boolean(value) : Number(value) > 0);
  }

  function getBagInputKey(input) {
    return input?.dataset?.bagClub || input?.dataset?.profileBagClub || "";
  }

  function sameBagData(a = {}, b = {}) {
    return JSON.stringify(normalizeBagData(a)) === JSON.stringify(normalizeBagData(b));
  }

  function getCurrentBagInputData() {
    const data = {};
    caddyBagInputs.forEach((input) => {
      const key = getBagInputKey(input);
      if (!key) return;
      const value = key === "putter" ? input.value.trim() : input.value;
      if (value !== "" || data[key] === undefined) data[key] = value;
    });
    return normalizeBagData(data);
  }

  function formatGolfBag(data, { estimated = false } = {}) {
    const normalized = normalizeBagData(data);
    const order = ["driver", "wood3", "wood5", "hybrid", "i5", "i6", "i7", "i8", "i9", "pw", "aw", "sw", "putter"];
    const parts = order.map((key) => {
      const value = normalized[key];
      if (!value) return null;
      return key === "putter" ? `${BAG_CLUB_LABELS[key]}：${value}` : `${BAG_CLUB_LABELS[key]} ${value}码`;
    }).filter(Boolean);
    if (!parts.length) return "";
    return `${estimated ? "默认估算：" : ""}${parts.join("，")}`;
  }

  function getCaddyBagProfile() {
    const current = getCurrentBagInputData();
    const estimated = normalizeBagData(estimateGolfBagFromDrive());
    if (hasCaddyBagValues(current)) {
      const savedBag = normalizeBagData(readSavedCaddyBag() || {});
      const saved = hasCaddyBagValues(savedBag) && sameBagData(savedBag, current);
      const estimatedSource = !saved && sameBagData(current, estimated);
      return { saved, estimated: estimatedSource, data: current, text: formatGolfBag(current, { estimated: estimatedSource }) };
    }
    return { saved: false, estimated: true, data: estimated, text: formatGolfBag(estimated, { estimated: true }) };
  }
  
  // ─── Dialogue Decision Tree v3.0 ────────────────────────────
  function getCaddyAdvice(loc, mode = "strategy", note = "") {
    if (!userProfile) return "请先完成您的专属高尔夫档案，我将为您提供个性化建议~";

    const c = getCaddyContext(loc, note);
    const highRiskPrefix = c.match.isHighRisk ? `难度「${c.difficulty}」高于你的「${userProfile.skill}」，先按保守策略处理。` : "";
    const weather = c.weatherText ? ` ${c.weatherText}` : "";

    if (mode === "club") {
      const clubAction = c.bagSaved
        ? `按你的已保存球包距离「${c.bagText}」分三档执行：Driver/3W 只用于宽落点，Hybrid/长铁负责安全推进，PW/AW/SW 留完整挥杆距离攻果岭。`
        : c.bagEstimated
          ? `先按开球档案估算球包「${c.bagText}」执行：Driver 控制开球，木杆/Hybrid 做推进，7i-PW 找标准落点，AW/SW 负责避开短边。保存真实球包后会按你的码数细化。`
          : `按你本次输入但尚未保存的球包「${c.bagText}」临时分析：宽落点用 Driver/3W，障碍前用 Hybrid/长铁或中铁铺到完整挖起杆距离。`;
      const clubNext = c.bagSaved
        ? "已读取已保存球包；如果当天状态有变化，只调整 8 成力量的可重复距离。"
        : c.bagEstimated
          ? "这是按开球距离生成的估算球包。保存“我的球包”后，我会按真实码数细化选杆。"
          : "这次建议已读取本次输入的球包。点击保存后，刷新页面和下次选杆建议都会继续使用这套距离。";
      return buildCaddySections({
        judgment: `${c.distanceText}${getCourseDisplayName(loc)} 是「${c.courseType}」球场，主要障碍是${c.hazardsText}。你的开球档案为「${c.drive}」，不需要每洞硬上一号木。`,
        action: clubAction,
        risk: `${c.miss} 是本场主要变量，遇到${c.hazardsText}时宁可少打 15-25 码，也不要追求旗杆方向。${weather}${c.noteText}`,
        next: clubNext,
      });
    }

    if (mode === "fix") {
      return buildCaddySections({
        judgment: `本场匹配度 ${c.pct}%。你的常见失误是「${c.miss}」，在「${c.courseType}」和${c.hazardsText}组合下，失误修正比进攻更重要。`,
        action: c.miss.includes("右") ? "开球前把目标线放到球道左中，握杆压力降到 6 成，收杆保持完整，避免只用手臂抢下杆。" : c.miss.includes("左") ? "目标线放到球道右中，转身到位后再释放杆头，避免上半身过快关闭杆面。" : c.miss.includes("短杆") ? "50 码内只保留两种落点：果岭前沿和旗杆短侧安全区，用肩膀节奏控制距离。" : "每杆只盯一个任务：开球找球道、第二杆找安全区、短杆找落点，不同时修三个问题。",
        risk: `${highRiskPrefix}${weather}连续失误后不要立刻加力，下一杆先用你最熟的球杆把球放回可控区域。${c.noteText}`,
        next: "本轮只记录一种失误触发点：站位、节奏或选杆。赛后再决定是否改动作。",
      });
    }

    if (mode === "training") {
      return buildCaddySections({
        judgment: `围绕「${c.goal}」，这座球场适合「${c.bestForText}」。训练重点不是多打球，而是把${c.hazardsText}前的决策练熟。`,
        action: `赛前 30 分钟：10 分钟热身、10 分钟开球落点、10 分钟 50-100 码。赛前 7 天：两次短杆距离控制，一次开球方向控制。长期：把${c.miss}作为主课题。`,
        risk: `${weather}不要赛前临时改大动作；当天只调整目标线、节奏和选杆。${c.noteText}`,
        next: "把练习结果转成 3 条比赛规则：保守开球线、标准攻果岭距离、短杆最低可接受落点。",
      });
    }

    if (mode === "routine") {
      return buildCaddySections({
        judgment: `${c.distanceText}目标是「${c.goal}」，本场难度「${c.difficulty}」，需要把体能和节奏提前安排好。`,
        action: `热身顺序：肩背和髋部 5 分钟、半挥杆 10 球、开球 6 球、练习果岭上坡/下坡各 6 球。球具检查：球、手套、鞋钉、毛巾、补水、防晒。`,
        risk: `${weather}${c.greenSpeedText}。前 3 洞不要追旗，先建立当天距离感。${c.noteText}`,
        next: "开球前做同一套例行程序：看风险、定落点、选保守杆、一次试挥、执行。",
      });
    }

    if (mode === "mental") {
      return buildCaddySections({
        judgment: `你的目标是「${c.goal}」，在${getCourseDisplayName(loc)}这类「${c.courseType}」球场，心理上最怕把一个失误扩大成两洞连锁。`,
        action: `落后时只看下一杆落点；连续失误后强制换成 80% 力量；关键洞前先说出“安全区在哪里”，再决定是否进攻。`,
        risk: `${highRiskPrefix}遇到${c.hazardsText}时，情绪越急越要选更大容错区。${weather}${c.noteText}`,
        next: "给自己设一个本轮心理指标：每次失误后 30 秒内完成复位，不复盘动作，只复盘目标。",
      });
    }

    if (mode === "bag") {
      return buildCaddySections({
        judgment: c.bagSaved
          ? `已读取你的球包距离：${c.bagText}。本场关键是用熟悉码数避开${c.hazardsText}。`
          : c.bagEstimated
            ? `还没有保存球包，当前使用默认估算：${c.bagText}。本场需要一个安全开球杆、一个球道推进杆和两个短杆距离。`
            : `当前读取的是你刚输入但尚未保存的球包：${c.bagText}。这套距离可以先用于本次临场分析。`,
        action: c.bagSaved || !c.bagEstimated ? "把球包分成三档：开球安全档、150 码内上果岭档、80 码内救分档。风大或水障前，优先选择能停在完整挥杆距离的球杆。" : "建议在“我的球包”里保存 Driver、3W/5W、Hybrid、铁杆和挖起杆距离，再按真实码数做策略。",
        risk: `${weather}不要用“最远距离”做选杆依据，用你 8 成力量能重复的距离做比赛码数。${c.noteText}`,
        next: c.bagSaved ? "下次刷新页面后仍会读取这套球包；如当天风大或身体疲劳，请在现场补充里写明。" : "保存球包后重新分析，选杆建议会明显按你的球杆距离调整。",
      });
    }

    if (c.match.isHighRisk) {
      return buildCaddySections({
        judgment: `${c.distanceText}${getCourseDisplayName(loc)} 难度「${c.difficulty}」高于你的「${userProfile.skill}」档案，匹配度 ${c.pct}%。`,
        action: `路线管理以保守为主：开球找宽区，第二杆只攻可见落点，短杆优先上果岭前沿。`,
        risk: `主要风险是${c.hazardsText}和${c.miss}叠加。${weather}${c.noteText}`,
        next: "先把前 3 洞当作节奏测试，不用成绩判断状态。",
      });
    }

    return buildCaddySections({
      judgment: `${c.distanceText}${getCourseDisplayName(loc)} 与你的档案匹配度 ${c.pct}%，类型「${c.courseType}」，主要障碍是${c.hazardsText}。`,
      action: c.pct >= 75 ? "可以选择性进攻，但只进攻落点清楚、下一杆角度好的位置；其他洞按球道中线和果岭前沿管理。" : "按体验局处理，优先球道、优先可见落点、优先完整挥杆距离，不把每个洞都打成进攻洞。",
      risk: `${weather}如果出现${c.miss}，立即切换到保守线，避免连续丢杆。${c.noteText}`,
      next: `本轮执行一句话：围绕「${c.goal}」，先少犯错，再找机会。`,
    });
  }
  
  // ─── Caddy Runtime: local LLM / cloud API / basic rules ─────
  const CADDY_MODEL_KEY = "golf-caddy-model";
  const DEFAULT_CADDY_MODEL = "qwen3:8b";
  const DEFAULT_LOCAL_CADDY_BASE = "http://localhost:11434/v1";
  const DEFAULT_CLOUD_CADDY_ENDPOINT = "/api/caddy";
  const LOCAL_CADDY_CHAT_TIMEOUT_MS = 90000;
  const CLOUD_CADDY_CHAT_TIMEOUT_MS = 45000;
  let detectedCaddyModel = null;
  let modelDetectionStarted = false;
  let localCaddyUnavailableReason = "";

  function normalizeCaddyMode(mode = appConfig.caddyMode) {
    return ["local", "cloud", "basic"].includes(mode) ? mode : "basic";
  }

  function normalizeApiBase(base, fallback) {
    return String(base || fallback).replace(/\/+$/, "");
  }

  function isGithubPagesStaticHost() {
    return window.location.hostname.endsWith(".github.io");
  }

  function isRelativeEndpoint(endpoint) {
    return String(endpoint || "").startsWith("/");
  }

  function getConfiguredCaddyMode() {
    return normalizeCaddyMode(appConfig.caddyMode);
  }

  function getCaddyModeLabel(mode) {
    if (mode === "local") return "本地大模型";
    if (mode === "cloud") return "云端球童";
    return "基础模式";
  }

  function updateCaddyRuntimeStatus(mode = "basic", detail = "") {
    if (!caddyRuntimeStatus) return;
    caddyRuntimeStatus.classList.remove("local", "cloud", "basic", "warning");
    caddyRuntimeStatus.classList.add(mode);
    caddyRuntimeStatus.textContent = `当前模式：${getCaddyModeLabel(mode)}${detail ? ` · ${detail}` : ""}`;
  }

  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      window.clearTimeout(timer);
    }
  }
  
  async function resolveCaddyModel() {
    if (detectedCaddyModel !== null) return detectedCaddyModel;
    if (modelDetectionStarted) return null;
    if (getConfiguredCaddyMode() !== "local") return null;
    if (isGithubPagesStaticHost()) return null;
  
    modelDetectionStarted = true;
    try {
      const localBaseUrl = normalizeApiBase(appConfig.localBaseUrl, DEFAULT_LOCAL_CADDY_BASE);
      const preferred = localStorage.getItem(CADDY_MODEL_KEY) || DEFAULT_CADDY_MODEL;
      const body = await fetchJsonWithTimeout(`${localBaseUrl}/models`, {}, 1600);
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
  
  function buildCaddyPrompt(loc, mode, note) {
    const m = calculateMatch(userProfile, loc);
    const modeConfig = CADDY_MODE_CONFIG[mode] || CADDY_MODE_CONFIG.strategy;
    const bagProfile = getCaddyBagProfile();
    const courseProfile = {
      name: loc.name,
      province: loc.province,
      city: loc.city,
      holes: loc.holes,
      par: loc.par,
      difficulty: loc.difficulty,
      priceLevel: loc.priceLevel,
      courseType: loc.courseType,
      hazards: loc.hazards,
      bestFor: loc.bestFor,
      grassType: loc.grassType,
      greenSpeed: loc.greenSpeed,
      signatureHoles: loc.signatureHoles,
      facilities: loc.facilities,
      tags: loc.tags,
    };
    const weatherProfile = currentCourseWeather ? {
      mode: currentCourseWeather.mode,
      source: currentCourseWeather.source,
      available: currentCourseWeather.available,
      summary: currentCourseWeather.summary,
      riskLevel: currentCourseWeather.riskLevel,
      risks: currentCourseWeather.risks,
      caddyBrief: currentCourseWeather.caddyBrief,
    } : null;
    const taskMap = {
      strategy: "球场攻略和路线管理",
      club: "选杆、距离控制和落点选择",
      training: "赛前训练计划和弱点修正",
      routine: "赛前准备、热身、节奏和注意事项",
      fix: "失误修正和本场补救策略",
      mental: "心理球童、压力处理和关键洞节奏",
      bag: "球包配置和基于球杆距离的选杆建议",
    };
    return [
      "你是一个现实球场里的专业中文高尔夫球童。你需要像真人球童一样，结合球员能力、常见失误、目标、球场地形和距离，给出具体而可执行的建议。",
      "不要只说推荐或不推荐。必须体现个人定制化。",
      `本次任务：${taskMap[mode] || modeConfig.task}`,
      `当前模式：${modeConfig.label}。模式重点：${modeConfig.task}`,
      "必须输出 4 个结构化段落，严格使用这些中文标题：【判断】【执行】【风险】【下一步】。每段 1-2 句，必须可执行。",
      "必须结合用户水平、平均杆数、开球距离、常见失误、本次目标、球场难度、障碍、距离和用户现场补充。",
      "不允许编造不存在的球洞编号、价格、电话、营业时间或实时天气；天气只能引用提供的天气风险字段。",
      "",
      `用户档案：${JSON.stringify(userProfile)}。档案摘要：${getProfileSummary()}`,
      `球场结构化档案：${JSON.stringify(courseProfile)}`,
      `天气与打球风险：${JSON.stringify(weatherProfile)}`,
      `用户位置距离：${formatDistance(getCourseDistance(loc)) || "未知"}`,
      `用户现场补充：${note || "无"}`,
      `用户球包配置：${bagProfile.text}`,
      `球包来源：${bagProfile.saved ? "用户已保存到 localStorage" : "根据开球距离区间生成的默认估算"}`,
      `匹配结果：${JSON.stringify({
        score: m.finalScore,
        highRisk: m.isHighRisk,
        matched: {
          terrain: m.terrainMatch,
          strategy: m.strategyMatch,
          environment: m.environmentMatch,
        },
      })}`,
    ].join("\n");
  }
  
  async function getCaddyAdviceFromLLM(loc, mode = "strategy", note = "") {
    const fallback = getCaddyAdvice(loc, mode, note);
    const configuredMode = getConfiguredCaddyMode();

    if (configuredMode === "basic") {
      updateCaddyRuntimeStatus("basic", "规则建议");
      return `${fallback}\n【来源】基础模式已启用：当前未请求本地或云端大模型。`;
    }

    if (configuredMode === "cloud") {
      const endpoint = appConfig.cloudEndpoint || DEFAULT_CLOUD_CADDY_ENDPOINT;
      if (isGithubPagesStaticHost() && isRelativeEndpoint(endpoint)) {
        updateCaddyRuntimeStatus("cloud", "云端球童服务未配置");
        return `${fallback}\n【来源】云端球童服务未配置。GitHub Pages 是静态站点，正式上线需要部署后端接口 /api/caddy。`;
      }

      try {
        updateCaddyRuntimeStatus("cloud", "分析中");
        const body = await fetchJsonWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            note,
            prompt: buildCaddyPrompt(loc, mode, note),
            course: {
              id: loc.id,
              name: loc.name,
              province: loc.province,
              city: loc.city,
              difficulty: loc.difficulty,
              courseType: loc.courseType,
              hazards: loc.hazards,
            },
            profile: userProfile,
          }),
        }, CLOUD_CADDY_CHAT_TIMEOUT_MS);
        const content = body?.advice || body?.content || body?.choices?.[0]?.message?.content;
        updateCaddyRuntimeStatus("cloud", "已连接");
        return String(content || fallback).trim();
      } catch {
        updateCaddyRuntimeStatus("basic", "云端不可用，已回退");
        return `${fallback}\n【来源】云端球童暂时不可用，已切换基础模式。`;
      }
    }

    if (isGithubPagesStaticHost()) {
      updateCaddyRuntimeStatus("basic", "线上不调用 localhost");
      return `${fallback}\n【来源】GitHub Pages 环境不会调用本机 Ollama，已切换基础模式。`;
    }

    const model = await resolveCaddyModel();
  
    if (!model) {
      const reason = localCaddyUnavailableReason || "本地 Ollama 未连接";
      updateCaddyRuntimeStatus("basic", reason);
      return `${fallback}\n【来源】${reason}，已启用基础模式。`;
    }
  
    try {
      updateCaddyRuntimeStatus("local", `使用 ${model} · 首次加载可能较慢`);
      const localBaseUrl = normalizeApiBase(appConfig.localBaseUrl, DEFAULT_LOCAL_CADDY_BASE);
      const body = await fetchJsonWithTimeout(`${localBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.72,
          max_tokens: 560,
          messages: [
            { role: "system", content: "你只输出中文高尔夫球童建议，不输出推理过程。语气专业、具体、像真人球童。输出必须有【判断】【执行】【风险】【下一步】四段，不要泛泛而谈。" },
            { role: "user", content: buildCaddyPrompt(loc, mode, note) },
          ],
        }),
      }, LOCAL_CADDY_CHAT_TIMEOUT_MS);
      const content = body?.choices?.[0]?.message?.content?.trim();
      updateCaddyRuntimeStatus("local", `使用 ${model}`);
      return content || fallback;
    } catch {
      updateCaddyRuntimeStatus("basic", "本地大模型未响应");
      return `${fallback}\n【来源】本地大模型暂时未响应，已切换基础建议。`;
    }
  }
  
  // ─── Scene ────────────────────────────────────────────────
  const scene = new THREE.Scene();
  
  // ─── Camera ───────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    200
  );
  
  // ─── Renderer ─────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getScenePixelRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.touchAction = "none";
  document.body.appendChild(renderer.domElement);
  
  // ─── Starfield ────────────────────────────────────────────
  function createStarfield() {
    const count = isLowPowerDevice() ? 520 : isCompactViewport() ? 900 : 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
  
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
  
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
  
      const brightness = 0.6 + Math.random() * 0.4;
      colors[i * 3]     = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness;
    }
  
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  
    const mat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  
    scene.add(new THREE.Points(geo, mat));
  }
  
  // ─── Lighting ─────────────────────────────────────────────
  function createLighting() {
    const ambient = new THREE.AmbientLight(0x334466, 1.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4dd, 5.8);
    sun.position.set(5, 2, 5);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x243658, 0.5);
    fill.position.set(-3, -1, -4);
    scene.add(fill);

    return { sun };
  }
  
  // ─── Earth ────────────────────────────────────────────────
  function createEarth() {
    const geo = new THREE.SphereGeometry(1, 128, 128);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x224488,
      specular: 0x1d3146,
      shininess: 18,
    });
    const earth = new THREE.Mesh(geo, mat);
    scene.add(earth);

    const TEXTURE_URLS = [
      "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg",
      "https://unpkg.com/three@0.160.0/examples/textures/planets/earth_atmos_2048.jpg",
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    ];

    function tryLoadTexture(index) {
      if (index >= TEXTURE_URLS.length) {
        mat.color.set(0x2255aa);
        mat.needsUpdate = true;
        reportPageResourceIssue(
          "地球贴图加载失败",
          "全部 CDN 源均无法加载地球纹理，已自动切换为基础蓝色地球。请检查网络连接。"
        );
        return;
      }
      const loader = new THREE.TextureLoader();
      loader.load(
        TEXTURE_URLS[index],
        (texture) => {
          texture.anisotropy = 16;
          texture.colorSpace = THREE.SRGBColorSpace;
          mat.map = texture;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        },
        undefined,
        () => tryLoadTexture(index + 1)
      );
    }

    tryLoadTexture(0);
    return earth;
  }
  
  // ─── Atmosphere glow ──────────────────────────────────────
  function createAtmosphere() {
    const geo = new THREE.SphereGeometry(1.015, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vPosition = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = 1.0 - abs(dot(viewDir, vNormal));
          fresnel = pow(fresnel, 3.5);
          float alpha = fresnel * 0.25;
          gl_FragColor = vec4(0.3, 0.6, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(geo, mat);
    scene.add(atmosphere);
  }
  
  function createSpaceAccents() {
    const sunGlow = createGlowTexture(255, 224, 150, 0.92);
    const sunCorona = createGlowTexture(255, 156, 74, 0.48);
    const moonGlow = createGlowTexture(190, 220, 255, 0.42);
    const moonTexture = createMoonTexture();

    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff0b8 })
    );
    scene.add(sunCore);

    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlow,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }));
    sunSprite.scale.set(5.2, 5.2, 1);
    scene.add(sunSprite);

    const sunCoronaSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunCorona,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    }));
    sunCoronaSprite.scale.set(8.4, 8.4, 1);
    scene.add(sunCoronaSprite);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 48, 48),
      new THREE.MeshStandardMaterial({
        map: moonTexture,
        color: 0xf0f1e8,
        emissive: 0x10151c,
        emissiveIntensity: 0.08,
        roughness: 0.96,
        metalness: 0,
      })
    );
    scene.add(moon);

    const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonGlow,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.44,
    }));
    moonHalo.scale.set(0.72, 0.72, 1);
    scene.add(moonHalo);

    return { sunCore, sunSprite, sunCoronaSprite, moon, moonHalo };
  }
  
  // ─── Coordinate utility ───────────────────────────────────
  function latLngToVec3(lat, lng, radius) {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lng + 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    );
  }
  
  function vec3ToLatLng(vec) {
    const normal = vec.clone().normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(clamp(normal.y, -1, 1)));
    let lng = THREE.MathUtils.radToDeg(Math.atan2(normal.z, -normal.x)) - 180;
    if (lng < -180) lng += 360;
    if (lng > 180) lng -= 360;
    return { lat, lng };
  }
  
  // ─── Glow texture factory ─────────────────────────────────
  function createGlowTexture(r, g, b, alpha) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }

  function createMoonTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    base.addColorStop(0, "#f2f0e3");
    base.addColorStop(0.42, "#aaa999");
    base.addColorStop(1, "#5d625e");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const patches = [
      [42, 34, 24, "rgba(82,82,78,0.34)"],
      [95, 72, 17, "rgba(58,58,56,0.28)"],
      [146, 40, 28, "rgba(130,128,118,0.26)"],
      [198, 86, 20, "rgba(64,66,64,0.32)"],
      [220, 32, 13, "rgba(180,178,166,0.22)"],
      [24, 98, 16, "rgba(46,48,48,0.26)"],
    ];
    patches.forEach(([x, y, r, color]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(0.72, color.replace(/0\.\d+/, "0.08"));
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let i = 0; i < 36; i++) {
      const x = (i * 47) % canvas.width;
      const y = (i * 29 + 17) % canvas.height;
      const r = 2 + (i % 5) * 1.8;
      ctx.strokeStyle = `rgba(70,72,70,${0.18 + (i % 3) * 0.05})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  function createCameraBadgeTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 48, 48);
    ctx.fillStyle = "rgba(6, 18, 30, 0.78)";
    ctx.strokeStyle = "rgba(120, 245, 226, 0.92)";
    ctx.lineWidth = 3;
    ctx.fillRect(9, 16, 30, 20);
    ctx.strokeRect(9, 16, 30, 20);
    ctx.fillStyle = "rgba(120, 245, 226, 0.95)";
    ctx.fillRect(15, 11, 11, 6);
    ctx.beginPath();
    ctx.arc(24, 26, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 211, 122, 0.98)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
  }
  
  // ─── Markers ──────────────────────────────────────────────
  const orangeTex = createGlowTexture(255, 170, 50, 0.75);
  const cyanTex = createGlowTexture(0, 255, 220, 0.9);
  const blueRingTex = createGlowTexture(80, 230, 255, 0.76);
  const modelRingTex = createGlowTexture(176, 145, 255, 0.72);
  const cameraBadgeTex = createCameraBadgeTexture();
  let markerContainer;
  
  function createMarkers(radius) {
    markerContainer = new THREE.Group();
    const dots = [];
  
    golfLocations.forEach((loc, i) => {
      const pos = latLngToVec3(loc.lat, loc.lng, radius * 1.006);
      const basePos = pos.clone();
  
      const geo = new THREE.SphereGeometry(0.0025, 8, 8);
      const dotMat = new THREE.MeshStandardMaterial({
        color: 0xd69a35,
        emissive: 0x442500,
        emissiveIntensity: 0.18,
        roughness: 0.5,
      });
      const dot = new THREE.Mesh(geo, dotMat);
      dot.userData = { index: i };
      dot.position.copy(pos);
      markerContainer.add(dot);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.userData = { index: i };
      hit.position.copy(pos);
      markerContainer.add(hit);
  
      const glowMat = new THREE.SpriteMaterial({
        map: orangeTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.15,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(pos);
      glow.scale.set(0.022, 0.022, 1);
      markerContainer.add(glow);

      const nearbyRingMat = new THREE.SpriteMaterial({
        map: blueRingTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      });
      const nearbyRing = new THREE.Sprite(nearbyRingMat);
      nearbyRing.position.copy(pos);
      nearbyRing.scale.set(0.036, 0.036, 1);
      markerContainer.add(nearbyRing);

      const cameraBadgeMat = new THREE.SpriteMaterial({
        map: cameraBadgeTex,
        depthWrite: false,
        transparent: true,
        opacity: hasCourseLocalRealview(loc) ? 0.9 : 0,
      });
      const cameraBadge = new THREE.Sprite(cameraBadgeMat);
      cameraBadge.position.copy(pos.clone().add(pos.clone().normalize().multiplyScalar(0.026)));
      cameraBadge.scale.set(0.018, 0.018, 1);
      markerContainer.add(cameraBadge);

      const modelRingMat = new THREE.SpriteMaterial({
        map: modelRingTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: hasCourseIndependentModel(loc) ? 0.36 : 0,
      });
      const modelRing = new THREE.Sprite(modelRingMat);
      modelRing.position.copy(pos.clone().add(pos.clone().normalize().multiplyScalar(0.012)));
      modelRing.scale.set(0.05, 0.05, 1);
      markerContainer.add(modelRing);

      dots.push({
        dot,
        hit,
        glow,
        nearbyRing,
        cameraBadge,
        modelRing,
        dotMat,
        glowMat,
        nearbyRingMat,
        cameraBadgeMat,
        modelRingMat,
        basePos,
        pillar: null,
        recommended: false,
        nearby: false,
        realview: hasCourseLocalRealview(loc),
        model: hasCourseIndependentModel(loc),
      });
    });
  
    scene.add(markerContainer);
    return dots;
  }

  function disposeMarkerPillar(marker) {
    if (!marker?.pillar) return;
    markerContainer.remove(marker.pillar);
    marker.pillar.geometry.dispose();
    marker.pillar.material.dispose();
    marker.pillar = null;
  }

  function createMarkerPillar(marker, color = 0x68f6ff, opacity = 0.68, height = 0.64) {
    disposeMarkerPillar(marker);
    const pillarGeo = new THREE.CylinderGeometry(0.0018, 0.0042, height, isLowPowerDevice() ? 6 : 10);
    const pillarMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isLowPowerDevice() ? opacity * 0.7 : opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    const normal = marker.basePos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    pillar.setRotationFromQuaternion(quat);
    pillar.position.copy(marker.basePos).add(normal.multiplyScalar(height * 0.5));
    pillar.userData = { index: marker.dot.userData.index };
    markerContainer.add(pillar);
    marker.pillar = pillar;
  }

  function getNearbyMarkerIndexes(limit = 18) {
    if (!userLocation) return new Set();
    return new Set(
      golfLocations
        .map((loc, index) => ({ index, distance: getCourseDistance(loc) }))
        .filter((item) => item.distance !== null && item.distance <= 300)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit)
        .map((item) => item.index)
    );
  }

  function updateGlobeMarkers() {
    if (!markerContainer || !markers?.length) return;
    const nearbyIndexes = getNearbyMarkerIndexes();
    markers.forEach((m, i) => {
      const loc = golfLocations[i];
      const match = userProfile ? calculateMatch(userProfile, loc) : null;
      const recommended = Boolean(match && match.finalScore >= 65 && !match.isHighRisk);
      const nearby = nearbyIndexes.has(i);
      const selected = selectedCourseIndex === i;
      m.recommended = recommended;
      m.nearby = nearby;
      m.realview = hasCourseLocalRealview(loc);
      m.model = hasCourseIndependentModel(loc);

      if (selected) {
        m.dotMat.color.set(0xffffff);
        m.dotMat.emissive.set(0x66f7ff);
        m.dotMat.emissiveIntensity = 1.8;
        m.glowMat.map = cyanTex;
        m.glowMat.opacity = 0.86;
        m.nearbyRingMat.opacity = 0.6;
        createMarkerPillar(m, 0x76f7ff, 0.78, 0.7);
      } else {
        disposeMarkerPillar(m);
        if (recommended) {
          m.dotMat.color.set(0xffc65c);
          m.dotMat.emissive.set(0xffcc42);
          m.dotMat.emissiveIntensity = 1.1;
          m.glowMat.map = cyanTex;
          m.glowMat.opacity = 0.54;
        } else {
          m.dotMat.color.set(0xd69a35);
          m.dotMat.emissive.set(0x5a3000);
          m.dotMat.emissiveIntensity = 0.28;
          m.glowMat.map = orangeTex;
          m.glowMat.opacity = 0.18;
        }
        m.nearbyRingMat.opacity = nearby ? 0.42 : 0;
      }
      m.cameraBadgeMat.opacity = m.realview ? 0.88 : 0;
      m.modelRingMat.opacity = m.model ? 0.34 : 0;
    });
  }
  
  // ─── Global scan after profile submission ─────────────────
  function scanAllCourses() {
    updateGlobeMarkers();
  }

  function getCourseDifficultyRank(loc) {
    return COURSE_DIFFICULTY_MAP[loc.difficulty] || COURSE_DIFFICULTY_MAP[loc.tags.skill] || 2;
  }

  function hasCourseLocalRealview(loc) {
    return Boolean(loc.realviewVideo || loc.panoVideo);
  }

  function hasCourseIndependentModel(loc) {
    return Boolean(loc.hasIndependentModel || (loc.model && loc.model !== DEFAULT_COURSE_MODEL_URL));
  }

  function getCourseLibraryText(loc) {
    return [
      loc.name,
      loc.province,
      loc.city,
      loc.address,
      loc.description,
      loc.courseType,
      loc.difficulty,
      loc.priceLevel,
      loc.grassType,
      loc.greenSpeed,
      ...(Array.isArray(loc.hazards) ? loc.hazards : []),
      ...(Array.isArray(loc.bestFor) ? loc.bestFor : []),
      loc.tags.strategy,
      loc.tags.terrain,
      loc.tags.environment,
      loc.tags.skill,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function createCourseLibraryRecord(loc, index) {
    const match = userProfile ? calculateMatch(userProfile, loc).finalScore : 0;
    const distance = getCourseDistance(loc);
    const distanceBoost = distance === null ? 0 : Math.max(0, 120 - distance) / 2;
    const difficultyRank = getCourseDifficultyRank(loc);
    const userLevel = userProfile ? LEVEL_MAP[userProfile.skill] || 2 : 2;
    const difficultyDelta = Math.abs(difficultyRank - userLevel);
    const difficultyScore = userProfile ? Math.max(0, 18 - difficultyDelta * 8) : 10;
    const distanceScore = distance === null ? 0 : Math.max(0, 70 - Math.min(distance, 700) * 0.1);
    const matchScore = userProfile ? match * 0.55 : 24;
    return {
      loc,
      index,
      match,
      distance,
      difficultyRank,
      nearbyScore: distanceScore + matchScore + difficultyScore,
      score: match + distanceBoost + (hasCourseLocalRealview(loc) ? 4 : 0) + (hasCourseIndependentModel(loc) ? 3 : 0),
    };
  }

  function getFilteredCourses() {
    const query = courseLibraryState.query.trim().toLowerCase();
    return golfLocations
      .map((loc, index) => createCourseLibraryRecord(loc, index))
      .filter(({ loc, match, distance }) => {
        if (query && !getCourseLibraryText(loc).includes(query)) return false;
        if (courseLibraryState.province !== "all" && loc.province !== courseLibraryState.province) return false;
        if (courseLibraryState.courseType !== "all" && loc.courseType !== courseLibraryState.courseType) return false;
        if (courseLibraryState.difficulty !== "all" && (loc.difficulty || loc.tags.skill) !== courseLibraryState.difficulty) return false;
        if (courseLibraryState.suitableOnly && (!userProfile || match < 65)) return false;
        if (courseLibraryState.videoOnly && !hasCourseLocalRealview(loc)) return false;
        if (courseLibraryState.modelOnly && !hasCourseIndependentModel(loc)) return false;
        if (courseLibraryState.mode === "nearby" && userLocation && courseLibraryState.nearbyRange !== "all") {
          const maxDistance = Number(courseLibraryState.nearbyRange);
          if (distance === null || distance > maxDistance) return false;
        }
        return true;
      });
  }

  function getRankedCourses(mode = courseLibraryState.mode) {
    const sortMode = mode === "nearby" && userLocation && courseLibraryState.sort === "recommend"
      ? "nearbyRecommend"
      : courseLibraryState.sort;
    const records = getFilteredCourses();
    if (sortMode === "distance" && !userLocation) return records.sort((a, b) => b.score - a.score);
    return records.sort((a, b) => {
      if (sortMode === "nearbyRecommend") return b.nearbyScore - a.nearbyScore || (a.distance ?? Infinity) - (b.distance ?? Infinity);
      if (sortMode === "distance") {
        if (a.distance === null && b.distance === null) return a.loc.name.localeCompare(b.loc.name, "zh-Hans-CN");
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      }
      if (sortMode === "match") return b.match - a.match || b.score - a.score;
      if (sortMode === "difficultyAsc") return a.difficultyRank - b.difficultyRank || b.score - a.score;
      if (sortMode === "difficultyDesc") return b.difficultyRank - a.difficultyRank || b.score - a.score;
      return b.score - a.score || b.match - a.match || a.loc.name.localeCompare(b.loc.name, "zh-Hans-CN");
    });
  }
  
  function syncCourseLibraryControls() {
    if (!listTools) return;
    listTools.hidden = false;
    if (listNearbyTools) listNearbyTools.hidden = courseLibraryState.mode !== "nearby";
    if (listSearch) listSearch.value = courseLibraryState.query;
    if (listProvinceFilter) listProvinceFilter.value = courseLibraryState.province;
    if (listTypeFilter) listTypeFilter.value = courseLibraryState.courseType;
    if (listDifficultyFilter) listDifficultyFilter.value = courseLibraryState.difficulty;
    if (listSortFilter) {
      const distanceOption = listSortFilter.querySelector('option[value="distance"]');
      if (distanceOption) distanceOption.disabled = !userLocation;
      if (courseLibraryState.sort === "distance" && !userLocation) courseLibraryState.sort = "recommend";
      listSortFilter.value = courseLibraryState.sort;
    }
    if (listSuitableFilter) {
      if (!userProfile) courseLibraryState.suitableOnly = false;
      listSuitableFilter.checked = courseLibraryState.suitableOnly;
      listSuitableFilter.disabled = !userProfile;
    }
    if (listVideoFilter) listVideoFilter.checked = courseLibraryState.videoOnly;
    if (listModelFilter) listModelFilter.checked = courseLibraryState.modelOnly;
    document.querySelectorAll("[data-nearby-range]").forEach((button) => {
      button.classList.toggle("active", button.dataset.nearbyRange === courseLibraryState.nearbyRange);
    });
  }

  function getLibraryNote(resultCount) {
    const notes = [];
    if (!userLocation) notes.push("开启定位或选择城市后可按距离排序。");
    if (courseLibraryState.mode === "nearby" && userLocation) notes.push("推荐分 = 距离分 + 球风匹配分 + 难度适配分。");
    if (!userProfile) notes.push("完成球风档案后可筛选适合当前用户的球场。");
    if (courseLibraryState.videoOnly) notes.push("本地实景仅展示已授权/已配置素材。");
    if (courseLibraryState.modelOnly) notes.push("独立 3D 模型指球场单独配置的模型，不含通用模型。");
    if (!notes.length) notes.push(`已找到 ${resultCount} 座球场。`);
    return notes.join(" ");
  }

  function getUserLocationLabel() {
    if (!userLocation) return "未开启";
    if (userLocationSource === "device") return "已开启定位，仅本地排序";
    if (userLocationSource === "city") return `已选择城市：${userLocation.city}`;
    return "已设置位置";
  }

  function updateNearbySummary(records) {
    if (!nearbyStatus || !nearbyCount || !nearbyDistance) return;
    const nearest = records.filter((item) => item.distance !== null).sort((a, b) => a.distance - b.distance)[0];
    nearbyStatus.textContent = `定位状态：${getUserLocationLabel()}`;
    nearbyCount.textContent = `最近球场：${records.length} 座`;
    nearbyDistance.textContent = `最近距离：${nearest ? formatDistance(nearest.distance) : "--"}`;
  }

  function getNearbyRangeLabel() {
    if (courseLibraryState.nearbyRange === "all") return "全国";
    return `${courseLibraryState.nearbyRange}km 内`;
  }

  function renderCourseList(mode = courseLibraryState.mode || "overview") {
    courseLibraryState.mode = mode;
    if (mode === "nearby" && userLocation && courseLibraryState.sort === "distance") courseLibraryState.sort = "recommend";
    syncCourseLibraryControls();
    const ranked = getRankedCourses(mode);
    const nearby = mode === "nearby";
    if (nearby) updateNearbySummary(ranked);
    const title = nearby ? "附近高尔夫球场" : "中国高尔夫球场库";
    const subtitle = nearby
      ? (userLocation ? `${getNearbyRangeLabel()}显示 ${ranked.length} / ${golfLocations.length} 座球场，按推荐分排序。` : "定位或选择城市后会按距离、匹配度和难度适配推荐。")
      : `收录 ${golfLocations.length} 座中国高尔夫球场，当前显示 ${ranked.length} 座。`;
  
    listTitle.textContent = title;
    listSubtitle.textContent = subtitle;
    if (listFilterNote) listFilterNote.textContent = getLibraryNote(ranked.length);
    listContent.innerHTML = ranked.map(({ loc, index, match, distance, nearbyScore }) => {
      const distanceText = formatDistance(distance) || "未定位";
      const matchText = userProfile ? `${match}%` : "建档后计算";
      const difficulty = loc.difficulty || loc.tags.skill;
      const badge = nearby && userLocation ? `推荐 ${Math.round(nearbyScore)}` : (userProfile ? `${match}%` : "查看");
      const locationText = [loc.province, loc.city].filter(Boolean).join(" · ") || "中国";
      const featureTags = [
        loc.tags.strategy,
        loc.tags.terrain,
        loc.tags.environment,
        loc.courseType,
        hasCourseLocalRealview(loc) ? "有实景" : null,
        hasCourseIndependentModel(loc) ? "独立模型" : null,
      ].filter(Boolean);
      return `
        <button class="course-row" type="button" data-course-index="${index}">
          <span class="course-row-title">
            <strong>${escapeHtml(getCourseDisplayName(loc))}</strong>
            <span>${escapeHtml(badge)}</span>
          </span>
          <span class="course-row-meta">
            <span>${escapeHtml(locationText)}</span>
            <span>距离 ${escapeHtml(distanceText)}</span>
            <span>匹配 ${escapeHtml(matchText)}</span>
            <span>难度 ${escapeHtml(difficulty)}</span>
          </span>
          <p class="course-row-desc">${escapeHtml(loc.description)}</p>
          <span class="course-row-tags">
            ${featureTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </span>
        </button>
      `;
    }).join("") || `<p class="list-empty">没有找到匹配的球场。可以减少筛选条件，或搜索“重庆”“观澜湖”“山地”等关键词。</p>`;
  
    listPanel.classList.add("visible");
    listPanel.setAttribute("aria-hidden", "false");
  }
  
  function populateCourseLibraryFilters() {
    const fillSelect = (select, allLabel, values) => {
      if (!select) return;
      select.innerHTML = [
        `<option value="all">${allLabel}</option>`,
        ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
      ].join("");
    };
    const provinces = [...new Set(golfLocations.map((loc) => loc.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const types = [...new Set(golfLocations.map((loc) => loc.courseType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    const preferredDifficulties = ["新手友好", "中等", "挑战", "锦标赛"];
    const difficulties = [
      ...preferredDifficulties.filter((value) => golfLocations.some((loc) => (loc.difficulty || loc.tags.skill) === value)),
      ...[...new Set(golfLocations.map((loc) => loc.difficulty || loc.tags.skill).filter(Boolean))]
        .filter((value) => !preferredDifficulties.includes(value)),
    ];
    fillSelect(listProvinceFilter, "全部省份", provinces);
    fillSelect(listTypeFilter, "全部类型", types);
    fillSelect(listDifficultyFilter, "全部难度", difficulties);
  }

  function populateNearbyCitySelect(select = nearbyCitySelect) {
    if (!select) return;
    select.innerHTML = [
      `<option value="">选择城市近似排序</option>`,
      ...NEARBY_CITIES.map((city) => `<option value="${escapeHtml(city.name)}">${escapeHtml(city.name)}</option>`),
    ].join("");
    const savedCity = localStorage.getItem(NEARBY_CITY_STORAGE_KEY);
    if (savedCity && NEARBY_CITIES.some((city) => city.name === savedCity)) select.value = savedCity;
  }

  function useManualNearbyCity(cityName, { fly = true } = {}) {
    const city = NEARBY_CITIES.find((item) => item.name === cityName);
    if (!city) return;
    userLocation = { lat: city.lat, lng: city.lng, city: city.name };
    userLocationSource = "city";
    localStorage.setItem(NEARBY_CITY_STORAGE_KEY, city.name);
    courseLibraryState.mode = "nearby";
    courseLibraryState.sort = "recommend";
    updateGlobeMarkers();
    renderCourseList("nearby");
    const nearest = getRankedCourses("nearby")[0];
    if (fly && nearest) flyToCourse(nearest.index, 1.7);
  }

  function startDeviceLocation() {
    if (!navigator.geolocation) {
      renderNearbyLocationPrompt("当前浏览器不支持定位，请选择城市继续使用附近球场。");
      return;
    }
  
    listTitle.textContent = "附近球场";
    listSubtitle.textContent = "正在获取当前位置，请在浏览器提示中允许定位。";
    if (listTools) listTools.hidden = true;
    listContent.innerHTML = `<p class="list-empty">定位只用于本地距离排序，不会上传定位数据，也不会保存精确经纬度。</p>`;
    listPanel.classList.add("visible");
    listPanel.setAttribute("aria-hidden", "false");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        userLocationSource = "device";
        courseLibraryState.mode = "nearby";
        courseLibraryState.sort = "recommend";
        updateGlobeMarkers();
        renderCourseList("nearby");
        const nearest = getRankedCourses("nearby")[0];
        if (nearest) flyToCourse(nearest.index, 1.7);
      },
      () => {
        renderNearbyLocationPrompt("定位未成功。你可以选择城市，继续按近似距离查看附近球场。");
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 300000 }
    );
  }
  
  function renderNearbyLocationPrompt(message = "") {
    courseLibraryState.mode = "nearby";
    listTitle.textContent = "附近球场";
    listSubtitle.textContent = "需要位置用于本地距离排序。";
    if (listTools) listTools.hidden = true;
    const savedCity = localStorage.getItem(NEARBY_CITY_STORAGE_KEY) || "";
    listContent.innerHTML = `
      <div class="nearby-permission-card">
        <strong>开启附近球场推荐</strong>
        <p>我们需要定位来计算你与球场的距离，并按“距离分 + 球风匹配分 + 难度适配分”生成附近推荐。</p>
        <p>定位仅在浏览器本地用于排序，不会上传定位数据，也不会保存精确经纬度。</p>
        ${message ? `<p class="course-provider-note">${escapeHtml(message)}</p>` : ""}
        <div class="course-action-row">
          <button class="course-realview-button" type="button" data-nearby-action="locate">开始定位</button>
          <button class="course-realview-button" type="button" data-nearby-action="overview">先看全国</button>
        </div>
        <label class="nearby-prompt-city">
          <span>或手动选择城市</span>
          <select id="nearby-prompt-city">
            <option value="">选择城市近似排序</option>
            ${NEARBY_CITIES.map((city) => `<option value="${escapeHtml(city.name)}" ${city.name === savedCity ? "selected" : ""}>${escapeHtml(city.name)}</option>`).join("")}
          </select>
        </label>
        <button class="course-realview-button" type="button" data-nearby-action="city">按所选城市排序</button>
      </div>
    `;
    listPanel.classList.add("visible");
    listPanel.setAttribute("aria-hidden", "false");
  }

  function showLocationStatus(text) {
    listTitle.textContent = "附近高尔夫球场";
    listSubtitle.textContent = text;
    if (listTools) listTools.hidden = true;
    listContent.innerHTML = `<p class="list-empty">${text}</p>`;
    listPanel.classList.add("visible");
    listPanel.setAttribute("aria-hidden", "false");
  }

  function requestNearbyCourses() {
    renderNearbyLocationPrompt();
  }

  populateCourseLibraryFilters();
  populateNearbyCitySelect();
  syncCourseLibraryControls();

  listSearch?.addEventListener("input", () => {
    courseLibraryState.query = listSearch.value;
    renderCourseList(courseLibraryState.mode);
  });
  listProvinceFilter?.addEventListener("change", () => {
    courseLibraryState.province = listProvinceFilter.value;
    renderCourseList(courseLibraryState.mode);
  });
  listTypeFilter?.addEventListener("change", () => {
    courseLibraryState.courseType = listTypeFilter.value;
    renderCourseList(courseLibraryState.mode);
  });
  listDifficultyFilter?.addEventListener("change", () => {
    courseLibraryState.difficulty = listDifficultyFilter.value;
    renderCourseList(courseLibraryState.mode);
  });
  listSortFilter?.addEventListener("change", () => {
    if (listSortFilter.value === "distance" && !userLocation) {
      courseLibraryState.sort = "recommend";
    } else {
      courseLibraryState.sort = listSortFilter.value;
    }
    renderCourseList(courseLibraryState.mode);
  });
  listSuitableFilter?.addEventListener("change", () => {
    courseLibraryState.suitableOnly = listSuitableFilter.checked;
    renderCourseList(courseLibraryState.mode);
  });
  listVideoFilter?.addEventListener("change", () => {
    courseLibraryState.videoOnly = listVideoFilter.checked;
    renderCourseList(courseLibraryState.mode);
  });
  listModelFilter?.addEventListener("change", () => {
    courseLibraryState.modelOnly = listModelFilter.checked;
    renderCourseList(courseLibraryState.mode);
  });
  document.querySelectorAll("[data-nearby-range]").forEach((button) => {
    button.addEventListener("click", () => {
      courseLibraryState.nearbyRange = button.dataset.nearbyRange || "300";
      renderCourseList("nearby");
    });
  });
  nearbyCitySelect?.addEventListener("change", () => {
    if (nearbyCitySelect.value) useManualNearbyCity(nearbyCitySelect.value);
  });

  overviewOpen.addEventListener("click", () => renderCourseList("overview"));
  locateNearby.addEventListener("click", requestNearbyCourses);
  listClose.addEventListener("click", () => {
    listPanel.classList.remove("visible");
    listPanel.setAttribute("aria-hidden", "true");
  });
  listContent.addEventListener("click", (e) => {
    const nearbyAction = e.target.closest("[data-nearby-action]");
    if (nearbyAction) {
      const action = nearbyAction.dataset.nearbyAction;
      if (action === "locate") startDeviceLocation();
      if (action === "overview") renderCourseList("overview");
      if (action === "city") {
        const promptCity = document.getElementById("nearby-prompt-city");
        if (promptCity?.value) useManualNearbyCity(promptCity.value);
      }
      return;
    }
    const row = e.target.closest("[data-course-index]");
    if (!row) return;
    const idx = Number(row.dataset.courseIndex);
    openCourse(idx, { fly: true });
  });
  
  // ─── Build scene ──────────────────────────────────────────
  createStarfield();
  const { sun } = createLighting();
  const earth = createEarth();
  createAtmosphere();

  // Asia-facing directional light — attached to Earth so it rotates with the globe,
  // keeping the Asian continent brightly lit at all times.
  const asiaLightPos = latLngToVec3(30, 110, 1).normalize().multiplyScalar(8);
  const asiaLight = new THREE.DirectionalLight(0xfff8e8, 3.0);
  asiaLight.position.copy(asiaLightPos);
  earth.add(asiaLight);

  const spaceAccents = createSpaceAccents();
  const markerRadius = 1;
  const markers = createMarkers(markerRadius);
  updateGlobeMarkers();
  
  // ─── Controls ─────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.22;
  controls.zoomSpeed = 0.45;
  controls.panSpeed = 0.35;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.35;
  controls.enablePan = false;
  controls.minDistance = 1.36;
  controls.maxDistance = 10;
  controls.target.set(0, 0, 0);
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  let earthUserInteracting = false;
  let lastEarthInteractionEnd = 0;
  controls.addEventListener("start", () => {
    earthUserInteracting = true;
  });
  controls.addEventListener("end", () => {
    earthUserInteracting = false;
    lastEarthInteractionEnd = performance.now();
  });
  
  const chinaDir = latLngToVec3(32, 108, 1);
  camera.position.copy(chinaDir.clone().multiplyScalar(3.2));
  controls.update();
  
  let earthCameraTween = null;
  
  function flyToCourse(index, distance = 1.55, onComplete = null) {
    const marker = markers[index];
    if (!marker) return false;
  
    const worldPos = new THREE.Vector3();
    marker.dot.getWorldPosition(worldPos);
    const normal = worldPos.normalize();
    earthCameraTween = {
      startTime: performance.now(),
      duration: prefersReducedMotion ? 260 : 860,
      fromPosition: camera.position.clone(),
      toPosition: normal.multiplyScalar(distance),
      onComplete,
    };
    controls.enabled = false;
    return true;
  }
  
  function pulseGlobeMarker(index) {
    const marker = markers[index];
    if (!marker) return;
    marker.clickPulseUntil = performance.now() + 900;
    marker.dotMat.emissiveIntensity = Math.max(marker.dotMat.emissiveIntensity, 1.7);
  }
  
  function updateEarthCameraTween() {
    if (!earthCameraTween) return;
  
    const p = Math.min((performance.now() - earthCameraTween.startTime) / earthCameraTween.duration, 1);
    const t = easeOutCubic(p);
    camera.position.lerpVectors(earthCameraTween.fromPosition, earthCameraTween.toPosition, t);
    controls.target.set(0, 0, 0);
    controls.update();
  
    if (p >= 1) {
      const onComplete = earthCameraTween.onComplete;
      earthCameraTween = null;
      controls.enabled = true;
      if (typeof onComplete === "function") onComplete();
    }
  }
  
  // ─── Progressive 2D Map Detail ─────────────────────────────
  const MAP_DETAIL_TRIGGER_DISTANCE = 1.72;
  const CHINA_MAP_BOUNDS = { minLat: 18, maxLat: 46, minLng: 73, maxLng: 135 };
  const CHINA_MAP_CENTER = { lat: 34.2, lng: 104.2 };
  const MAP_BASE_ZOOM = 4;
  const MAP_MIN_SCALE = 1;
  const MAP_MAX_SCALE = 64;
  const MAP_TILE_SIZE = 256;
  const mapConfig = window.GOLF_MAP_CONFIG || {};
  const mapTileProviders = {
    amapSatellite: {
      label: "高德卫星",
      coordinateSystem: "gcj02",
      maxZoom: 18,
      layers: [
        {
          template: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
          subdomains: ["1", "2", "3", "4"],
          opacity: 1,
        },
        {
          template: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
          subdomains: ["1", "2", "3", "4"],
          opacity: 0.52,
        },
      ],
      attribution: "高德卫星底图",
    },
    amapRoad: {
      label: "高德路网",
      coordinateSystem: "gcj02",
      maxZoom: 18,
      layers: [
        {
          template: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
          subdomains: ["1", "2", "3", "4"],
          opacity: 1,
        },
      ],
      attribution: "高德路网底图",
    },
    osm: {
      label: "标准地图",
      coordinateSystem: "wgs84",
      maxZoom: 19,
      layers: [
        {
          template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          subdomains: [""],
          opacity: 1,
        },
      ],
      attribution: "OpenStreetMap 标准底图",
    },
  };
  let activeMapProviderKey = mapTileProviders[mapConfig.mapTileProvider] ? mapConfig.mapTileProvider : "amapSatellite";
  const tileCache = new Map();
  const detailMapCtx = detailMapCanvas ? detailMapCanvas.getContext("2d") : null;
  let mapDetailVisible = false;
  let mapRenderPending = false;
  let mapTileRenderQueued = false;
  let lastMapQualityBucket = -1;
  let mapTween = null;
  const mapPointers = new Map();
  const mapState = {
    scale: 1.25,
    panX: 0,
    panY: 0,
    ctrlDown: false,
    panning: false,
    dragging: false,
    moved: false,
    pinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchCenterX: 0,
    pinchCenterY: 0,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    selectedIndex: null,
    hoverIndex: null,
    hoverClusterKey: null,
    selectedClusterKey: null,
    selectedClusterLevel: null,
    activeNodes: [],
    clickLocked: false,
  };
  
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  
  function getDetailMapRect() {
    const rect = detailMapCanvas.getBoundingClientRect();
    return { width: Math.max(1, rect.width), height: Math.max(1, rect.height), left: rect.left, top: rect.top };
  }
  
  function resizeDetailMapCanvas(width, height, { force = false } = {}) {
    const maxQuality = isCompactViewport() ? 2.25 : 3.2;
    const qualityBucket = Math.min(5, Math.floor(Math.log2(Math.max(1, mapState.scale))));
    const quality = clamp((window.devicePixelRatio || 1) * (1 + qualityBucket * 0.16), 1, maxQuality);
    const nextW = Math.max(1, Math.round(width * quality));
    const nextH = Math.max(1, Math.round(height * quality));
    if (force || qualityBucket !== lastMapQualityBucket || detailMapCanvas.width !== nextW || detailMapCanvas.height !== nextH) {
      detailMapCanvas.width = nextW;
      detailMapCanvas.height = nextH;
      lastMapQualityBucket = qualityBucket;
    }
    detailMapCtx.setTransform(quality, 0, 0, quality, 0, 0);
    return quality;
  }
  
  function applyMapTransform(ctx, width, height) {
    ctx.translate(width / 2 + mapState.panX, height / 2 + mapState.panY);
    ctx.scale(mapState.scale, mapState.scale);
    ctx.translate(-width / 2, -height / 2);
  }
  
  function transformLatForGcj(lng, lat) {
    let ret = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    ret += (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3;
    ret += (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
    return ret;
  }
  
  function transformLngForGcj(lng, lat) {
    let ret = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3;
    ret += (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3;
    ret += (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3;
    return ret;
  }
  
  function isOutsideChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  
  function wgs84ToGcj02(lat, lng) {
    if (isOutsideChina(lat, lng)) return { lat, lng };
    const a = 6378245.0;
    const ee = 0.00669342162296594323;
    let dLat = transformLatForGcj(lng - 105.0, lat - 35.0);
    let dLng = transformLngForGcj(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    return { lat: lat + dLat, lng: lng + dLng };
  }
  
  function getActiveMapProvider() {
    return mapTileProviders[activeMapProviderKey] || mapTileProviders.amapSatellite;
  }
  
  function getCourseMapCenter(loc) {
    const center = loc?.courseMapCenter;
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) return center;
    return { lat: loc.lat, lng: loc.lng };
  }
  
  function getCourseMapName(loc) {
    return loc?.amapPoiName || loc?.amapSearchKeyword || `${loc.name} 高尔夫球场`;
  }
  
  function isCourseMapVerified(loc) {
    return loc?.mapPrecision === "verified" || loc?.mapPrecision === "amap-poi";
  }
  
  function toProviderLngLat(loc, provider = getActiveMapProvider()) {
    const center = getCourseMapCenter(loc);
    if (provider.coordinateSystem === "gcj02") return wgs84ToGcj02(center.lat, center.lng);
    return center;
  }
  
  function lngLatToWorld(lng, lat, zoom) {
    const sinLat = Math.sin(clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180);
    const worldSize = MAP_TILE_SIZE * 2 ** zoom;
    return {
      x: ((lng + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
    };
  }
  
  function getTileZoom() {
    const detailBoost = mapState.scale >= 5 ? 1 : 0;
    const zoom = Math.round(MAP_BASE_ZOOM + Math.log2(Math.max(1, mapState.scale)) + detailBoost);
    return clamp(zoom, 4, getActiveMapProvider().maxZoom);
  }
  
  function getMapRawPoint(loc, width, height) {
    const provider = getActiveMapProvider();
    const center = provider.coordinateSystem === "gcj02" ? wgs84ToGcj02(CHINA_MAP_CENTER.lat, CHINA_MAP_CENTER.lng) : CHINA_MAP_CENTER;
    const target = toProviderLngLat(loc, provider);
    const centerWorld = lngLatToWorld(center.lng, center.lat, MAP_BASE_ZOOM);
    const targetWorld = lngLatToWorld(target.lng, target.lat, MAP_BASE_ZOOM);
    return {
      x: width / 2 + targetWorld.x - centerWorld.x,
      y: height / 2 + targetWorld.y - centerWorld.y,
    };
  }
  
  function projectCourseToMap(loc, width, height) {
    const raw = getMapRawPoint(loc, width, height);
    return {
      x: (raw.x - width / 2) * mapState.scale + width / 2 + mapState.panX,
      y: (raw.y - height / 2) * mapState.scale + height / 2 + mapState.panY,
    };
  }
  
  function getPanForRawPoint(raw, width, height, scale) {
    return {
      panX: -(raw.x - width / 2) * scale,
      panY: -(raw.y - height / 2) * scale,
    };
  }
  
  function centerMapOnLatLng(lat, lng, scale = mapState.scale) {
    const { width, height } = getDetailMapRect();
    const raw = getMapRawPoint({ lat, lng }, width, height);
    mapState.scale = clamp(scale, MAP_MIN_SCALE, MAP_MAX_SCALE);
    const pan = getPanForRawPoint(raw, width, height, mapState.scale);
    mapState.panX = pan.panX;
    mapState.panY = pan.panY;
    clampMapPan(width, height);
  }
  
  function centerMapOnCourse(index, scale = 4.2) {
    const loc = golfLocations[index];
    if (!loc) return;
    const { width, height } = getDetailMapRect();
    const raw = getMapRawPoint(loc, width, height);
    mapState.scale = clamp(scale, MAP_MIN_SCALE, MAP_MAX_SCALE);
    const pan = getPanForRawPoint(raw, width, height, mapState.scale);
    mapState.panX = pan.panX;
    mapState.panY = pan.panY;
    clampMapPan(width, height);
  }
  
  function clampMapPan(width, height) {
    const maxX = width * (0.5 + mapState.scale * 0.78);
    const maxY = height * (0.5 + mapState.scale * 0.78);
    mapState.panX = clamp(mapState.panX, -maxX, maxX);
    mapState.panY = clamp(mapState.panY, -maxY, maxY);
  }
  
  function drawChinaPath(ctx, width, height) {
    const pts = [
      [0.21, 0.35], [0.28, 0.25], [0.43, 0.19], [0.57, 0.21],
      [0.69, 0.28], [0.79, 0.39], [0.84, 0.53], [0.76, 0.66],
      [0.62, 0.74], [0.49, 0.79], [0.38, 0.74], [0.30, 0.67],
      [0.20, 0.59], [0.17, 0.47],
    ];
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = px * width;
      const y = py * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  
  function formatTileUrl(template, x, y, z, subdomains) {
    const subdomain = subdomains?.length ? subdomains[Math.abs(x + y + z) % subdomains.length] : "";
    return template
      .replace("{s}", subdomain)
      .replace("{x}", x)
      .replace("{y}", y)
      .replace("{z}", z);
  }
  
  function queueTileRender() {
    if (!mapDetailVisible || mapTileRenderQueued) return;
    mapTileRenderQueued = true;
    window.setTimeout(() => {
      mapTileRenderQueued = false;
      renderDetailMap();
    }, 48);
  }

  function getTileImage(url) {
    let entry = tileCache.get(url);
    if (entry) return entry;

    const image = new Image();
    entry = { image, loaded: false, error: false };
    tileCache.set(url, entry);
    image.onload = () => {
      entry.loaded = true;
      queueTileRender();
    };
    image.onerror = () => {
      entry.error = true;
      queueTileRender();
    };
    image.referrerPolicy = "no-referrer";
    image.src = url;
    return entry;
  }
  
  function drawMapLoadingGrid(ctx, width, height) {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#07131a");
    bg.addColorStop(0.55, "#0d2427");
    bg.addColorStop(1, "#162a24");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(120, 220, 255, 0.08)";
    ctx.lineWidth = 1;
    const step = 64;
    for (let x = -step; x < width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + (mapState.panX % step), 0);
      ctx.lineTo(x + (mapState.panX % step), height);
      ctx.stroke();
    }
    for (let y = -step; y < height + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + (mapState.panY % step));
      ctx.lineTo(width, y + (mapState.panY % step));
      ctx.stroke();
    }
  }
  
  function drawTileLayer(ctx, width, height, provider, layer, zoom) {
    const center = provider.coordinateSystem === "gcj02" ? wgs84ToGcj02(CHINA_MAP_CENTER.lat, CHINA_MAP_CENTER.lng) : CHINA_MAP_CENTER;
    const centerWorld = lngLatToWorld(center.lng, center.lat, zoom);
    const scaleToScreen = mapState.scale / 2 ** (zoom - MAP_BASE_ZOOM);
    const tileScreenSize = MAP_TILE_SIZE * scaleToScreen;
    const tileCount = 2 ** zoom;
    const minTileX = Math.floor((centerWorld.x - (width / 2 + mapState.panX) / scaleToScreen) / MAP_TILE_SIZE) - 1;
    const maxTileX = Math.ceil((centerWorld.x + (width / 2 - mapState.panX) / scaleToScreen) / MAP_TILE_SIZE) + 1;
    const minTileY = Math.floor((centerWorld.y - (height / 2 + mapState.panY) / scaleToScreen) / MAP_TILE_SIZE) - 1;
    const maxTileY = Math.ceil((centerWorld.y + (height / 2 - mapState.panY) / scaleToScreen) / MAP_TILE_SIZE) + 1;
  
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= tileCount) continue;
        const url = formatTileUrl(layer.template, wrappedX, ty, zoom, layer.subdomains);
        const entry = getTileImage(url);
        if (!entry.loaded || entry.error) continue;
        const x = (tx * MAP_TILE_SIZE - centerWorld.x) * scaleToScreen + width / 2 + mapState.panX;
        const y = (ty * MAP_TILE_SIZE - centerWorld.y) * scaleToScreen + height / 2 + mapState.panY;
        ctx.drawImage(entry.image, Math.round(x), Math.round(y), Math.ceil(tileScreenSize + 1), Math.ceil(tileScreenSize + 1));
      }
    }
    ctx.restore();
  }
  
  function drawCourseDetailHints(ctx, width, height) {
    if (mapState.scale < 8) return;
    golfLocations.forEach((loc, index) => {
      const p = projectCourseToMap(loc, width, height);
      if (p.x < -180 || p.x > width + 180 || p.y < -180 || p.y > height + 180) return;
      const match = userProfile ? calculateMatch(userProfile, loc).finalScore : 60;
      const strong = match >= 65 || index === mapState.selectedIndex;
      const size = clamp(54 + mapState.scale * 1.4, 62, 118);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((index % 11) * 0.29);
      ctx.globalAlpha = strong ? 0.44 : 0.25;
      ctx.fillStyle = "rgba(93, 205, 112, 0.42)";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.72, size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(245, 236, 190, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-size * 0.62, -size * 0.05);
      ctx.bezierCurveTo(-size * 0.18, -size * 0.36, size * 0.18, size * 0.32, size * 0.62, size * 0.02);
      ctx.stroke();
      ctx.fillStyle = "rgba(60, 145, 210, 0.34)";
      ctx.beginPath();
      ctx.ellipse(size * 0.34, size * 0.12, size * 0.18, size * 0.06, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
  
  function drawTerrainBackground(ctx, width, height) {
    const provider = getActiveMapProvider();
    const zoom = getTileZoom();
    drawMapLoadingGrid(ctx, width, height);
    provider.layers.forEach((layer) => drawTileLayer(ctx, width, height, provider, layer, zoom));
  
    if (activeMapProviderKey === "amapSatellite") {
      ctx.fillStyle = "rgba(4, 14, 18, 0.12)";
      ctx.fillRect(0, 0, width, height);
    }
  
    drawCourseDetailHints(ctx, width, height);
  
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.24, width * 0.5, height * 0.48, width * 0.76);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  
    ctx.fillStyle = "rgba(238, 250, 255, 0.72)";
    ctx.font = "12px Microsoft YaHei, sans-serif";
    ctx.fillText(`${provider.attribution} · z${zoom}`, 16, height - 16);
  }
  
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  
  function getCourseProvince(loc) {
    if (loc.province) return loc.province;
    if (loc.lat <= 21.5 && loc.lng >= 108 && loc.lng <= 112) return "海南";
    if (loc.lng >= 109 && loc.lng <= 117 && loc.lat <= 25) return "广东";
    if (loc.lng >= 98 && loc.lng <= 106 && loc.lat >= 21 && loc.lat <= 29) return "云南";
    if (loc.lng >= 118 && loc.lng <= 123 && loc.lat >= 28 && loc.lat <= 33) return "华东";
    if (loc.lng >= 113 && loc.lng <= 119 && loc.lat >= 38) return "京津冀";
    if (loc.lng >= 120 && loc.lat >= 35) return "东北沿海";
    if (loc.lng >= 103 && loc.lng <= 108 && loc.lat >= 28 && loc.lat <= 32) return "川渝";
    return "其他区域";
  }

  function getCourseCity(loc) {
    if (loc.city) return loc.city;
    const name = loc.name || "";
    const city = NEARBY_CITIES.find((item) => name.includes(item.name));
    if (city) return city.name;
    return getCourseProvince(loc);
  }

  function getClusterCenter(items) {
    const total = items.reduce((acc, item) => {
      acc.lat += item.loc.lat;
      acc.lng += item.loc.lng;
      return acc;
    }, { lat: 0, lng: 0 });
    return { lat: total.lat / items.length, lng: total.lng / items.length };
  }

  function getClusterLevel() {
    if (mapState.scale < 2.35) return "province";
    if (mapState.scale < 5.4 && mapState.selectedClusterLevel !== "city") return "city";
    return "course";
  }

  function createClusterNode(level, key, label, records, width, height) {
    const center = getClusterCenter(records);
    const point = projectCourseToMap(center, width, height);
    return {
      type: level === "course" ? "course" : "cluster",
      level,
      key,
      label,
      records,
      count: records.length,
      lat: center.lat,
      lng: center.lng,
      x: point.x,
      y: point.y,
    };
  }

  function getMapNodes(width, height) {
    const records = golfLocations.map((loc, index) => ({ loc, index }));
    const level = getClusterLevel();
    if (level === "course") {
      const selectedPrefix = mapState.selectedClusterKey ? `${mapState.selectedClusterKey}|` : "";
      return records
        .filter(({ loc }) => {
          if (!selectedPrefix) return mapState.scale >= 7.5;
          const province = getCourseProvince(loc);
          const city = getCourseCity(loc);
          return `${province}|${city}` === mapState.selectedClusterKey || province === mapState.selectedClusterKey;
        })
        .map((record) => {
          const p = projectCourseToMap(record.loc, width, height);
          return { type: "course", level: "course", key: `course:${record.index}`, label: getCourseDisplayName(record.loc), records: [record], count: 1, x: p.x, y: p.y };
        });
    }

    const groups = new Map();
    records.forEach((record) => {
      const province = getCourseProvince(record.loc);
      const city = getCourseCity(record.loc);
      const key = level === "province" ? province : `${province}|${city}`;
      const label = level === "province" ? province : city;
      if (!groups.has(key)) groups.set(key, { label, records: [] });
      groups.get(key).records.push(record);
    });
    return [...groups.entries()].map(([key, group]) => createClusterNode(level, key, group.label, group.records, width, height));
  }

  function drawMapNodeLabel(ctx, node, label, x, y, selected = false) {
    ctx.font = selected ? "700 13px Microsoft YaHei, sans-serif" : "12px Microsoft YaHei, sans-serif";
    const textW = ctx.measureText(label).width;
    ctx.fillStyle = selected ? "rgba(5, 22, 28, 0.82)" : "rgba(5, 18, 22, 0.68)";
    ctx.strokeStyle = selected ? "rgba(110, 242, 225, 0.52)" : "rgba(130, 236, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundedRect(ctx, x, y - 17, textW + 16, 24, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(238, 252, 255, 0.94)";
    ctx.fillText(label, x + 8, y);
  }

  function drawMapMarkers(ctx, width, height) {
    const nodes = getMapNodes(width, height).filter((node) => node.x >= -100 && node.x <= width + 100 && node.y >= -100 && node.y <= height + 100);
    mapState.activeNodes = nodes;
    nodes.forEach((node) => {
      const selected = node.key === mapState.selectedClusterKey || (node.type === "course" && node.records[0]?.index === mapState.selectedIndex);
      const hovered = node.key === mapState.hoverClusterKey || (node.type === "course" && node.records[0]?.index === mapState.hoverIndex);
      if (node.type === "cluster") {
        const r = clamp(13 + Math.sqrt(node.count) * 2.8, 18, 38);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.9, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "rgba(90, 245, 220, 0.2)" : hovered ? "rgba(255,255,255,0.16)" : "rgba(42, 210, 178, 0.13)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "#f5fffb" : node.level === "province" ? "#62f0d2" : "#ffd06a";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.62)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = "rgba(5, 18, 22, 0.88)";
        ctx.font = "700 12px Microsoft YaHei, sans-serif";
        const countText = String(node.count);
        ctx.fillText(countText, node.x - ctx.measureText(countText).width / 2, node.y + 4);
        drawMapNodeLabel(ctx, node, `${node.label} ${node.count}`, node.x + r + 8, node.y - 4, selected || hovered);
        return;
      }

      const record = node.records[0];
      const loc = record.loc;
      const index = record.index;
      const match = userProfile ? calculateMatch(userProfile, loc).finalScore : 0;
      const strong = selected || hovered || match >= 65 || !userProfile;
      const r = selected ? 7.6 : hovered ? 6.4 : strong ? 5.1 : 3.3;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * (selected || hovered ? 4 : 3.1), 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(95, 230, 255, 0.24)" : hovered ? "rgba(255,255,255,0.18)" : strong ? "rgba(0, 255, 214, 0.13)" : "rgba(255, 176, 70, 0.1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#ffffff" : strong ? "#49ffe1" : "#e7ae55";
      ctx.fill();
      ctx.strokeStyle = selected || hovered ? "rgba(80, 230, 255, 0.95)" : "rgba(255,255,255,0.42)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      if (selected || hovered) {
        const label = hovered && !selected && mapState.scale >= 9.5 ? `${getCourseDisplayName(loc)} · ${loc.city || getCourseProvince(loc)}` : getCourseDisplayName(loc);
        drawMapNodeLabel(ctx, node, label, node.x + 10, node.y - 8, selected || hovered);
      }
    });
  }
  
  function renderDetailMapNow() {
    if (!detailMapCtx || !mapDetailVisible) return;
    const { width, height } = getDetailMapRect();
    const quality = resizeDetailMapCanvas(width, height, { force: !detailMapCanvas.width || !detailMapCanvas.height });
    detailMapCtx.clearRect(0, 0, width, height);
    drawTerrainBackground(detailMapCtx, width, height);
    drawMapMarkers(detailMapCtx, width, height);
  
    const target = mapState.selectedIndex === null ? (mapState.selectedClusterKey || "中国高尔夫局部地图") : getCourseDisplayName(golfLocations[mapState.selectedIndex]);
    mapDetailTitle.textContent = target;
    mapDetailMeta.textContent = isTouchDevice
      ? "点击省份或区域聚合进入详情，双指缩放；点开具体球场后查看球场详情。"
      : mapState.ctrlDown
      ? "Ctrl 平移中：拖动画面可水平 / 垂直移动。"
      : "滚轮平滑缩放，点击省份/城市聚合进入区域详情，再选择具体球场。";
    mapDetailScale.textContent = `${getActiveMapProvider().label} · 瓦片 z${getTileZoom()} · 细节 ${quality.toFixed(1)}x · 缩放 ${mapState.scale.toFixed(1)}x`;
  }
  
  function renderDetailMap() {
    if (mapRenderPending) return;
    mapRenderPending = true;
    requestAnimationFrame(() => {
      mapRenderPending = false;
      renderDetailMapNow();
    });
  }
  
  function animateMapView({ toScale, toPanX, toPanY, duration = 260, onComplete = null } = {}) {
    const { width, height } = getDetailMapRect();
    const nextScale = clamp(toScale ?? mapState.scale, MAP_MIN_SCALE, MAP_MAX_SCALE);
    mapTween = {
      startTime: performance.now(),
      duration: prefersReducedMotion ? 80 : duration,
      fromScale: mapState.scale,
      fromPanX: mapState.panX,
      fromPanY: mapState.panY,
      toScale: nextScale,
      toPanX: clamp(toPanX ?? mapState.panX, -width * (0.5 + nextScale * 0.78), width * (0.5 + nextScale * 0.78)),
      toPanY: clamp(toPanY ?? mapState.panY, -height * (0.5 + nextScale * 0.78), height * (0.5 + nextScale * 0.78)),
      onComplete,
    };
    return true;
  }

  function animateMapToCourse(index, { scale = 4.3, duration = 620, onComplete = null } = {}) {
    const loc = golfLocations[index];
    if (!loc) return false;
    const { width, height } = getDetailMapRect();
    const raw = getMapRawPoint(loc, width, height);
    const nextScale = clamp(Math.max(scale, mapState.scale), MAP_MIN_SCALE, MAP_MAX_SCALE);
    const pan = getPanForRawPoint(raw, width, height, nextScale);
    return animateMapView({
      toScale: nextScale,
      toPanX: pan.panX,
      toPanY: pan.panY,
      duration,
      onComplete,
    });
  }
  
  function updateMapTween() {
    if (!mapTween) return;
    const p = Math.min((performance.now() - mapTween.startTime) / mapTween.duration, 1);
    const t = easeInOutCubic(p);
    mapState.scale = THREE.MathUtils.lerp(mapTween.fromScale, mapTween.toScale, t);
    mapState.panX = THREE.MathUtils.lerp(mapTween.fromPanX, mapTween.toPanX, t);
    mapState.panY = THREE.MathUtils.lerp(mapTween.fromPanY, mapTween.toPanY, t);
    renderDetailMap();
  
    if (p >= 1) {
      const onComplete = mapTween.onComplete;
      mapTween = null;
      if (typeof onComplete === "function") onComplete();
    }
  }
  
  function primeVisibleMapTiles() {
    if (!detailMapCtx) return;
    const { width, height } = getDetailMapRect();
    const provider = getActiveMapProvider();
    const zoom = getTileZoom();
    provider.layers.forEach((layer) => drawTileLayer(detailMapCtx, width, height, provider, layer, zoom));
  }

  function enterMapDetail(index = null, { fromGlobe = false } = {}) {
    if (!mapDetailLayer || !detailMapCanvas || isTransitioning) return;
    isTransitioning = true;
    viewMode = "transition";
    mapDetailVisible = true;
    mapState.selectedIndex = Number.isInteger(index) ? index : null;
    mapTween = null;
    if (!Number.isInteger(index)) {
      const focus = vec3ToLatLng(camera.position.clone().normalize());
      const targetLat = clamp(focus.lat, CHINA_MAP_BOUNDS.minLat, CHINA_MAP_BOUNDS.maxLat);
      const targetLng = clamp(focus.lng, CHINA_MAP_BOUNDS.minLng, CHINA_MAP_BOUNDS.maxLng);
      centerMapOnLatLng(targetLat, targetLng, Math.max(mapState.scale, 1.34));
    }
    if (Number.isInteger(index)) centerMapOnCourse(index);
    if (fromGlobe) showTransition("正在进入高精度地图");
    document.body.classList.add("map-transitioning");
    listPanel.classList.remove("visible");
    listPanel.setAttribute("aria-hidden", "true");
    controls.enabled = false;
    primeVisibleMapTiles();
    renderDetailMapNow();
    requestAnimationFrame(() => {
      document.body.classList.add("map-mode");
      mapDetailLayer.classList.add("visible");
      mapDetailLayer.setAttribute("aria-hidden", "false");
    });
    window.setTimeout(() => {
      hideTransition();
      document.body.classList.remove("map-transitioning");
      viewMode = "map";
      unlockTransition();
      renderDetailMap();
    }, prefersReducedMotion ? 100 : 360);
  }
  
  function exitMapDetail({ keepCamera = false, instant = false } = {}) {
    if (!mapDetailLayer || !mapDetailVisible) return;
    if (isTransitioning && !instant) return;
    if (!instant) {
      isTransitioning = true;
      viewMode = "transition";
      showTransition("正在返回地球视角");
    }
    mapDetailVisible = false;
    mapState.dragging = false;
    mapState.panning = false;
    mapState.pinching = false;
    mapPointers.clear();
    hideMapRegionPanel();
    mapState.selectedClusterKey = null;
    mapState.selectedClusterLevel = null;
    mapState.hoverClusterKey = null;
    mapDetailLayer.classList.remove("visible");
    mapDetailLayer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("map-mode");
    document.body.classList.remove("map-transitioning");
    controls.enabled = true;
    if (!keepCamera) {
      earthCameraTween = {
        startTime: performance.now(),
        duration: instant || prefersReducedMotion ? 1 : 720,
        fromPosition: camera.position.clone(),
        toPosition: chinaDir.clone().multiplyScalar(3.2),
        onComplete: () => {
          hideTransition();
          viewMode = "globe";
          unlockTransition();
        },
      };
      controls.enabled = false;
    } else {
      hideTransition();
      viewMode = "map";
      unlockTransition();
    }
  }
  
  function zoomDetailMapAt(clientX, clientY, factor, { animated = false } = {}) {
    const { width, height, left, top } = getDetailMapRect();
    const oldScale = mapState.scale;
    const nextScale = clamp(oldScale * factor, MAP_MIN_SCALE, MAP_MAX_SCALE);
    if (Math.abs(nextScale - oldScale) < 0.001) return;

    const x = clientX - left;
    const y = clientY - top;
    const worldX = (x - width / 2 - mapState.panX) / oldScale;
    const worldY = (y - height / 2 - mapState.panY) / oldScale;
    const nextPanX = x - width / 2 - worldX * nextScale;
    const nextPanY = y - height / 2 - worldY * nextScale;
    if (animated) {
      animateMapView({
        toScale: nextScale,
        toPanX: nextPanX,
        toPanY: nextPanY,
        duration: 190,
      });
      return;
    }
    mapState.scale = nextScale;
    mapState.panX = nextPanX;
    mapState.panY = nextPanY;
    clampMapPan(width, height);
    renderDetailMap();
  }
  
  function hideMapRegionPanel() {
    mapRegionPanel?.classList.remove("visible");
    mapRegionPanel?.setAttribute("aria-hidden", "true");
  }

  function renderMapRegionPanel(node) {
    if (!mapRegionPanel || !mapRegionTitle || !mapRegionMeta || !mapRegionContent || !node) return;
    const records = [...node.records].sort((a, b) => {
      const cityCompare = getCourseCity(a.loc).localeCompare(getCourseCity(b.loc), "zh-Hans-CN");
      return cityCompare || a.loc.name.localeCompare(b.loc.name, "zh-Hans-CN");
    });
    mapRegionTitle.textContent = node.level === "province" ? `${node.label}球场区域` : `${node.label}区域详情`;
    mapRegionMeta.textContent = `${records.length} 座球场 · ${node.level === "province" ? "点击城市继续聚合" : "点击球场进入详情"}`;

    if (node.level === "province") {
      const cityGroups = new Map();
      records.forEach((record) => {
        const city = getCourseCity(record.loc);
        if (!cityGroups.has(city)) cityGroups.set(city, []);
        cityGroups.get(city).push(record);
      });
      mapRegionContent.innerHTML = [...cityGroups.entries()].map(([city, cityRecords]) => `
        <button class="map-region-row" type="button" data-map-region-key="${escapeHtml(`${node.key}|${city}`)}" data-map-region-level="city">
          <span><strong>${escapeHtml(city)}</strong><em>${cityRecords.length} 座球场</em></span>
          <b>进入</b>
        </button>
      `).join("");
    } else {
      mapRegionContent.innerHTML = records.map(({ loc, index }) => {
        const distance = formatDistance(getCourseDistance(loc)) || "未定位";
        const match = userProfile ? `${calculateMatch(userProfile, loc).finalScore}%` : "建档后计算";
        return `
          <button class="map-region-row course" type="button" data-course-index="${index}">
            <span><strong>${escapeHtml(getCourseDisplayName(loc))}</strong><em>${escapeHtml([getCourseProvince(loc), getCourseCity(loc)].filter(Boolean).join(" · "))}</em></span>
            <small>距离 ${escapeHtml(distance)} · 匹配 ${escapeHtml(match)}</small>
          </button>
        `;
      }).join("");
    }
    mapRegionPanel.classList.add("visible");
    mapRegionPanel.setAttribute("aria-hidden", "false");
  }

  function selectMapCluster(node) {
    if (!node || node.type !== "cluster") return false;
    mapState.selectedClusterKey = node.key;
    mapState.selectedClusterLevel = node.level;
    mapState.hoverClusterKey = null;
    mapState.hoverIndex = null;
    renderMapRegionPanel(node);
    const targetScale = node.level === "province" ? Math.max(mapState.scale, 3.2) : Math.max(mapState.scale, 6.2);
    centerMapOnLatLng(node.lat, node.lng, mapState.scale);
    const { width, height } = getDetailMapRect();
    const raw = getMapRawPoint({ lat: node.lat, lng: node.lng }, width, height);
    const pan = getPanForRawPoint(raw, width, height, targetScale);
    animateMapView({ toScale: targetScale, toPanX: pan.panX, toPanY: pan.panY, duration: 460 });
    return true;
  }

  function findMapNodeAt(clientX, clientY) {
    const { left, top } = getDetailMapRect();
    const x = clientX - left;
    const y = clientY - top;
    let best = null;
    let bestDistance = Infinity;
    mapState.activeNodes.forEach((node) => {
      const radius = node.type === "cluster" ? clamp(18 + Math.sqrt(node.count) * 2.8, 24, 44) : Math.max(16, 28 - mapState.scale * 1.5);
      const d = Math.hypot(node.x - x, node.y - y);
      if (d <= radius && d < bestDistance) {
        best = node;
        bestDistance = d;
      }
    });
    return best;
  }

  function findMapCourseAt(clientX, clientY) {
    const node = findMapNodeAt(clientX, clientY);
    return node?.type === "course" ? node.records[0].index : null;
  }
  
  function updateDetailMapCursor() {
    if (!detailMapCanvas) return;
    detailMapCanvas.classList.toggle("ctrl-pan", mapState.ctrlDown || mapState.panning || isTouchDevice);
    detailMapCanvas.classList.toggle("is-panning", mapState.panning);
    if (mapDetailVisible) renderDetailMap();
  }
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Control" && !mapState.ctrlDown) {
      mapState.ctrlDown = true;
      updateDetailMapCursor();
    }
  });
  
  window.addEventListener("keyup", (e) => {
    if (e.key === "Control") {
      mapState.ctrlDown = false;
      updateDetailMapCursor();
    }
  });
  
  detailMapCanvas.addEventListener("wheel", (e) => {
    if (!mapDetailVisible || isTransitioning) return;
    e.preventDefault();
    if (mapState.scale <= 1.04 && e.deltaY > 0) {
      exitMapDetail();
      return;
    }
    zoomDetailMapAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.34 : 0.78, { animated: true });
  }, { passive: false });
  
  function updateMapPointer(pointerEvent) {
    mapPointers.set(pointerEvent.pointerId, {
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      pointerType: pointerEvent.pointerType,
    });
  }
  
  function getTouchPointers() {
    return [...mapPointers.values()].filter((p) => p.pointerType === "touch");
  }
  
  function getPointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  
  function getPointerCenter(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }
  
  detailMapCanvas.addEventListener("pointerdown", (e) => {
    if (!mapDetailVisible || isTransitioning) return;
    detailMapCanvas.setPointerCapture(e.pointerId);
    updateMapPointer(e);
    mapState.startX = e.clientX;
    mapState.startY = e.clientY;
    mapState.startPanX = mapState.panX;
    mapState.startPanY = mapState.panY;
    mapState.moved = false;
  
    const touches = getTouchPointers();
    if (touches.length >= 2) {
      const [a, b] = touches;
      const center = getPointerCenter(a, b);
      mapState.pinching = true;
      mapState.dragging = false;
      mapState.panning = false;
      mapState.pinchStartDistance = Math.max(1, getPointerDistance(a, b));
      mapState.pinchStartScale = mapState.scale;
      mapState.pinchCenterX = center.x;
      mapState.pinchCenterY = center.y;
      mapState.moved = true;
      updateDetailMapCursor();
      return;
    }
  
    if (e.pointerType === "touch" || e.ctrlKey || mapState.ctrlDown) {
      mapState.dragging = true;
      mapState.panning = true;
      updateDetailMapCursor();
    }
  });
  
  detailMapCanvas.addEventListener("pointermove", (e) => {
    if (!mapDetailVisible) return;
    updateMapPointer(e);
    const touches = getTouchPointers();
    if (mapState.pinching && touches.length >= 2) {
      const [a, b] = touches;
      const center = getPointerCenter(a, b);
      const distance = Math.max(1, getPointerDistance(a, b));
      const factor = distance / Math.max(1, mapState.pinchStartDistance);
      zoomDetailMapAt(center.x, center.y, mapState.pinchStartScale * factor / mapState.scale);
      mapState.moved = true;
      return;
    }
  
    if (!mapState.dragging) {
      if (!isTouchDevice) {
        const hoverNode = findMapNodeAt(e.clientX, e.clientY);
        const hoverIndex = hoverNode?.type === "course" ? hoverNode.records[0].index : null;
        const hoverClusterKey = hoverNode?.type === "cluster" ? hoverNode.key : null;
        if (hoverIndex !== mapState.hoverIndex || hoverClusterKey !== mapState.hoverClusterKey) {
          mapState.hoverIndex = hoverIndex;
          mapState.hoverClusterKey = hoverClusterKey;
          renderDetailMap();
        }
      }
      return;
    }
  
    const dx = e.clientX - mapState.startX;
    const dy = e.clientY - mapState.startY;
    if (Math.hypot(dx, dy) > 2) mapState.moved = true;
    mapState.panX = mapState.startPanX + dx;
    mapState.panY = mapState.startPanY + dy;
    const { width, height } = getDetailMapRect();
    clampMapPan(width, height);
    renderDetailMap();
  });
  
  detailMapCanvas.addEventListener("pointerup", (e) => {
    if (!mapDetailVisible || isTransitioning) {
      mapPointers.delete(e.pointerId);
      return;
    }
    updateMapPointer(e);
    const wasDrag = mapState.pinching || mapState.moved;
    mapPointers.delete(e.pointerId);
    if (mapState.dragging) {
      mapState.dragging = false;
      mapState.panning = false;
      updateDetailMapCursor();
      if (wasDrag || e.ctrlKey || mapState.ctrlDown) return;
    }
    if (mapState.pinching) {
      mapState.pinching = getTouchPointers().length >= 2;
      if (wasDrag) return;
    }
  
    const node = findMapNodeAt(e.clientX, e.clientY);
    if (node?.type === "cluster") {
      selectMapCluster(node);
      return;
    }
    if (node?.type === "course") {
      const index = node.records[0].index;
      mapState.selectedIndex = index;
      renderDetailMapNow();
      openCourse(index, { fly: true, distance: 1.42 });
      return;
    }
    if (!e.ctrlKey && !mapState.ctrlDown) zoomDetailMapAt(e.clientX, e.clientY, 1.55, { animated: true });
  });
  
  detailMapCanvas.addEventListener("pointercancel", (e) => {
    mapPointers.delete(e.pointerId);
    mapState.dragging = false;
    mapState.panning = false;
    mapState.pinching = false;
    updateDetailMapCursor();
  });
  
  detailMapCanvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "touch" && (mapState.hoverIndex !== null || mapState.hoverClusterKey !== null)) {
      mapState.hoverIndex = null;
      mapState.hoverClusterKey = null;
      renderDetailMap();
    }
  });

  mapRegionClose?.addEventListener("click", () => {
    mapState.selectedClusterKey = null;
    mapState.selectedClusterLevel = null;
    hideMapRegionPanel();
    renderDetailMap();
  });

  mapRegionContent?.addEventListener("click", (e) => {
    const courseRow = e.target.closest("[data-course-index]");
    if (courseRow) {
      const index = Number(courseRow.dataset.courseIndex);
      if (!Number.isFinite(index)) return;
      mapState.selectedIndex = index;
      animateMapToCourse(index, {
        scale: Math.max(mapState.scale, 6.8),
        duration: 420,
        onComplete: () => openCourse(index, { fly: true, distance: 1.42 }),
      });
      return;
    }
    const regionRow = e.target.closest("[data-map-region-key]");
    if (!regionRow) return;
    const key = regionRow.dataset.mapRegionKey;
    const node = mapState.activeNodes.find((item) => item.key === key) || getMapNodes(getDetailMapRect().width, getDetailMapRect().height).find((item) => item.key === key);
    if (node) selectMapCluster(node);
  });

  mapDetailReset.addEventListener("click", () => {
    mapState.scale = 1.25;
    mapState.panX = 0;
    mapState.panY = 0;
    mapState.selectedIndex = null;
    mapState.selectedClusterKey = null;
    mapState.selectedClusterLevel = null;
    hideMapRegionPanel();
    renderDetailMapNow();
  });
  
  mapDetailClose.addEventListener("click", () => {
    exitMapDetail();
  });
  
  mapProviderTools?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-map-provider]");
    if (!button) return;
    const nextProvider = button.dataset.mapProvider;
    if (!mapTileProviders[nextProvider] || nextProvider === activeMapProviderKey) return;
    activeMapProviderKey = nextProvider;
    mapProviderTools.querySelectorAll("[data-map-provider]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    renderDetailMapNow();
  });
  
  function maybeEnterMapDetailFromGlobe() {
    if (viewMode !== "globe" || mapDetailVisible || earthCameraTween || isTransitioning) return;
    if (!profileModal.classList.contains("hidden")) return;
    if (overlay.classList.contains("visible")) return;
    if (camera.position.length() <= MAP_DETAIL_TRIGGER_DISTANCE) enterMapDetail(null, { fromGlobe: true });
  }
  
  function requestMapDetailAfterZoom() {
    if (viewMode !== "globe" || mapDetailVisible || isTransitioning) return;
    requestAnimationFrame(() => maybeEnterMapDetailFromGlobe());
  }
  
  // ─── Mini 3D Clubhouse Scene ──────────────────────────────
  const modelCanvas = document.getElementById("model-canvas");
  const modelTerrainToggle = document.getElementById("model-terrain-toggle");
  const modelGenericToggle = document.getElementById("model-generic-toggle");
  const modelRotateToggle = document.getElementById("model-rotate-toggle");
  const modelRotateSpeed = document.getElementById("model-rotate-speed");
  const photoDetail = document.getElementById("photo-detail");
  const photoDetailImage = document.getElementById("photo-detail-image");
  const photoDetailVideo = document.getElementById("photo-detail-video");
  const photoDetailTitle = document.getElementById("photo-detail-title");
  const photoDetailMeta = document.getElementById("photo-detail-meta");
  const photoDetailClose = document.getElementById("photo-detail-close");
  const modelRenderer = new THREE.WebGLRenderer({
    canvas: modelCanvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  modelRenderer.setPixelRatio(getModelPixelRatio());
  modelRenderer.setClearColor(0x000000, 0);
  
  const modelScene = new THREE.Scene();
  const modelCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  modelCamera.position.set(3.5, 4.5, 5.0);
  modelCamera.lookAt(0, -0.5, 0);
  
  const modelControls = new OrbitControls(modelCamera, modelCanvas);
  modelControls.enableDamping = true;
  modelControls.dampingFactor = 0.08;
  modelControls.enableRotate = true;
  modelControls.enablePan = false;
  modelControls.rotateSpeed = Number(modelRotateSpeed.value);
  modelControls.zoomSpeed = 0.65;
  modelControls.panSpeed = 0.45;
  modelControls.minDistance = 0.75;
  modelControls.maxDistance = 8;
  modelControls.minPolarAngle = Math.PI * 0.18;
  modelControls.maxPolarAngle = Math.PI * 0.52;
  modelControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  modelControls.touches.ONE = THREE.TOUCH.ROTATE;
  modelControls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  modelControls.target.set(0, -0.45, 0);
  modelControls.update();
  
  let modelRotationEnabled = true;
  let modelIsDragging = false;
  
  function syncModelRotationMode() {
    modelControls.enableRotate = true;
    modelControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    modelControls.touches.ONE = THREE.TOUCH.ROTATE;
    modelControls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    modelRotateToggle.textContent = modelRotationEnabled ? "自动环绕：开" : "自动环绕：关";
    modelRotateToggle.classList.toggle("active", modelRotationEnabled);
  }
  
  modelRotateToggle.addEventListener("click", () => {
    modelRotationEnabled = !modelRotationEnabled;
    syncModelRotationMode();
  });
  
  modelRotateSpeed.addEventListener("input", () => {
    modelControls.rotateSpeed = Number(modelRotateSpeed.value);
  });
  
  syncModelRotationMode();
  
  let lastModelW = 0;
  let lastModelH = 0;
  
  function updateModelRendererSize() {
    const w = modelCanvas.clientWidth;
    const h = modelCanvas.clientHeight;
    if (w > 0 && h > 0 && (w !== lastModelW || h !== lastModelH)) {
      modelRenderer.setSize(w, h);
      modelCamera.aspect = w / Math.max(h, 1);
      modelCamera.updateProjectionMatrix();
      lastModelW = w;
      lastModelH = h;
    }
  }
  
  modelScene.add(new THREE.AmbientLight(0xccccdd, 2.5));
  const modelSun = new THREE.DirectionalLight(0xffffff, 5);
  modelSun.position.set(3, 5, 4);
  modelScene.add(modelSun);
  const modelFill = new THREE.DirectionalLight(0x8899cc, 2);
  modelFill.position.set(-2, 1, -3);
  modelScene.add(modelFill);
  
  // Load GLTF model
  const modelGroup = new THREE.Group();
  const courseTerrainGroup = new THREE.Group();
  modelScene.add(modelGroup);
  modelScene.add(courseTerrainGroup);
  courseTerrainGroup.visible = true;
  modelGroup.visible = false;
  let modelHasFallback = false;
  let modelViewMode = "terrain";
  let terrainLoadToken = 0;
  const amapCourseResolutionCache = new Map();
  const courseTerrainTextureCache = new Map();
  const courseModelCache = new Map();
  let activeModelLoadToken = 0;
  
  function disposeObject3D(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => {
        material.dispose?.();
      });
    });
  }
  
  function clearCourseTerrainGroup() {
    while (courseTerrainGroup.children.length) {
      const child = courseTerrainGroup.children[0];
      courseTerrainGroup.remove(child);
      disposeObject3D(child);
    }
  }
  
  function getAmapTileUrlForCourse(x, y, z, style = 6) {
    const host = style === 6 ? "webst" : "webrd";
    const server = Math.abs(x + y + z) % 4 + 1;
    if (style === 6) return `https://${host}0${server}.is.autonavi.com/appmaptile?style=6&x=${x}&y=${y}&z=${z}`;
    return `https://${host}0${server}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`;
  }
  
  function loadTileBitmap(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.referrerPolicy = "no-referrer";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }
  
  async function createCourseSatelliteCanvas(loc) {
    const verified = isCourseMapVerified(loc);
    const canvasSize = isCompactViewport() ? 1024 : 1536;
    const zoom = verified ? 17 : 15;
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    const courseCenter = getCourseMapCenter(loc);
    const center = wgs84ToGcj02(courseCenter.lat, courseCenter.lng);
    const centerWorld = lngLatToWorld(center.lng, center.lat, zoom);
    const minWorldX = centerWorld.x - canvasSize / 2;
    const minWorldY = centerWorld.y - canvasSize / 2;
    const minTileX = Math.floor(minWorldX / MAP_TILE_SIZE);
    const maxTileX = Math.floor((minWorldX + canvasSize) / MAP_TILE_SIZE);
    const minTileY = Math.floor(minWorldY / MAP_TILE_SIZE);
    const maxTileY = Math.floor((minWorldY + canvasSize) / MAP_TILE_SIZE);
    const tileCount = 2 ** zoom;
    let loadedCount = 0;
  
    ctx.fillStyle = "#13231f";
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  
    for (let pass = 0; pass < 2; pass++) {
      const style = pass === 0 ? 6 : 8;
      ctx.globalAlpha = pass === 0 ? 1 : 0.38;
      const jobs = [];
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
        for (let ty = minTileY; ty <= maxTileY; ty++) {
          if (ty < 0 || ty >= tileCount) continue;
          const url = getAmapTileUrlForCourse(wrappedX, ty, zoom, style);
          jobs.push(loadTileBitmap(url).then((image) => {
            if (!image) return;
            const dx = Math.round(tx * MAP_TILE_SIZE - minWorldX);
            const dy = Math.round(ty * MAP_TILE_SIZE - minWorldY);
            ctx.drawImage(image, dx, dy, MAP_TILE_SIZE + 1, MAP_TILE_SIZE + 1);
            if (pass === 0) loadedCount += 1;
          }));
        }
      }
      await Promise.all(jobs);
    }
  
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    shade.addColorStop(0, "rgba(255,255,255,0.08)");
    shade.addColorStop(0.45, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.20)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  
    ctx.fillStyle = "rgba(2, 8, 10, 0.48)";
    ctx.fillRect(0, canvasSize - 78, canvasSize, 78);
    ctx.fillStyle = "rgba(238, 250, 255, 0.92)";
    ctx.font = "700 32px Microsoft YaHei, sans-serif";
    ctx.fillText(getCourseDisplayName(loc), 36, canvasSize - 36);
    ctx.font = "20px Microsoft YaHei, sans-serif";
    ctx.fillText(`${getCourseMapName(loc)} · ${verified ? "已校准球场实景" : "估算球场范围"} · 高德卫星瓦片`, 36, canvasSize - 12);
  
    if (!verified) {
      ctx.fillStyle = "rgba(255, 210, 120, 0.88)";
      ctx.font = "18px Microsoft YaHei, sans-serif";
      ctx.fillText("未配置高德 Key 时使用较大范围卫星图，接入 API 后会自动锁定球场 POI。", 36, canvasSize - 104);
    }
  
    if (!loadedCount) throw new Error("satellite tiles failed");
    return canvas;
  }
  
  function createTerrainLoadingMesh() {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 4.2, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x284538, roughness: 0.92, metalness: 0.02 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.38;
    courseTerrainGroup.add(mesh);
  }
  
  async function updateCourseTerrainView(index) {
    const loc = golfLocations[index];
    if (!loc) return;
    const token = ++terrainLoadToken;
    clearCourseTerrainGroup();
    createTerrainLoadingMesh();
    modelLabel.textContent = `${getCourseDisplayName(loc)} · 正在加载实景卫星地形`;
  
    try {
      const courseCenter = getCourseMapCenter(loc);
      const textureKey = `${loc.id}-${loc.mapPrecision || "estimated"}-${courseCenter.lat.toFixed(5)}-${courseCenter.lng.toFixed(5)}`;
      let texture = courseTerrainTextureCache.get(textureKey);
      if (!texture) {
        const canvas = await createCourseSatelliteCanvas(loc);
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(modelRenderer.capabilities.getMaxAnisotropy?.() || 1, 8);
        courseTerrainTextureCache.set(textureKey, texture);
      }
      if (token !== terrainLoadToken || selectedCourseIndex !== index) return;
      clearCourseTerrainGroup();
  
      const geometry = new THREE.PlaneGeometry(6.4, 4.65, 96, 72);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const ridge = Math.sin(x * 2.6 + y * 1.2) * 0.035 + Math.cos(y * 3.2) * 0.025;
        const edge = Math.max(Math.abs(x) / 3.2, Math.abs(y) / 2.325);
        positions.setZ(i, ridge - Math.max(0, edge - 0.72) * 0.18);
      }
      geometry.computeVertexNormals();
  
      const terrain = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.82,
          metalness: 0.02,
        })
      );
      terrain.rotation.x = -Math.PI / 2;
      terrain.position.y = -0.34;
      courseTerrainGroup.add(terrain);
  
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(6.45, 0.16, 4.7),
        new THREE.MeshStandardMaterial({ color: 0x12201d, roughness: 0.9 })
      );
      base.position.y = -0.49;
      courseTerrainGroup.add(base);
  
      modelLabel.textContent = `${getCourseDisplayName(loc)} · 实景卫星 2.5D 地形`;
    } catch {
      if (token !== terrainLoadToken) return;
      reportPageResourceIssue(
        "实景地形贴图加载失败",
        "高德瓦片或球场地形贴图没有成功加载，已自动切换为备用 3D 地形。请检查网络和地图瓦片访问情况。"
      );
      clearCourseTerrainGroup();
      createFallbackCourseModel();
      modelGroup.visible = true;
      courseTerrainGroup.visible = false;
      modelLabel.textContent = `${getCourseDisplayName(loc)} · 卫星地形加载失败，已切回 3D 模型`;
    }
  }
  
  function syncModelViewButtons() {
    modelTerrainToggle?.classList.toggle("active", modelViewMode === "terrain");
    modelGenericToggle?.classList.toggle("active", modelViewMode === "model");
  }

  function hasAmapJsKey() {
    return Boolean(String(mapConfig.amapKey || "").trim());
  }
  
  function gcj02ToWgs84(lat, lng) {
    if (isOutsideChina(lat, lng)) return { lat, lng };
    let wLat = lat;
    let wLng = lng;
    for (let i = 0; i < 8; i++) {
      const gcj = wgs84ToGcj02(wLat, wLng);
      wLat -= gcj.lat - lat;
      wLng -= gcj.lng - lng;
    }
    return { lat: wLat, lng: wLng };
  }
  
  function getCourseMapKeyword(loc) {
    return loc.amapSearchKeyword || `${loc.province || ""} ${loc.city || ""} ${getCourseMapName(loc)} 高尔夫球场`.trim();
  }

  function buildSearchKeywords(loc) {
    const keywords = [];
    // 关键词1：高德 POI 名称（如有预设）
    if (loc.amapPoiName) keywords.push(loc.amapPoiName);
    // 关键词2：球场名 + 高尔夫
    keywords.push(`${loc.name} 高尔夫`);
    // 关键词3：纯净球场名（去掉常见后缀）
    const cleanName = loc.name.replace(/高尔夫|俱乐部|球会|球场|国际/g, "").trim();
    if (cleanName && cleanName !== loc.name) {
      keywords.push(`${cleanName} 高尔夫`);
      keywords.push(cleanName);
    }
    // 去重
    return [...new Set(keywords)];
  }

  function searchAmapPOI(AMap, keyword, city, citylimit, pageSize = 15) {
    return new Promise((resolve) => {
      if (!AMap?.PlaceSearch) {
        AMap.plugin?.("AMap.PlaceSearch", () => {
          resolve(searchAmapPOI(AMap, keyword, city, citylimit, pageSize));
        });
        return;
      }
      const search = new AMap.PlaceSearch({
        city: city || "全国",
        citylimit: Boolean(citylimit),
        pageSize,
        extensions: "base",
      });
      search.search(keyword, (status, result) => {
        const pois = result?.poiList?.pois || [];
        resolve(pois);
      });
    });
  }

  function pickBestPoi(loc, pois) {
    if (!pois.length) return null;
    const scored = pois
      .map((poi) => ({ poi, score: scoreAmapCoursePoi(loc, poi), location: getAmapPoiLocation(poi) }))
      .filter((item) => item.location && item.score >= 12)
      .sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  async function tryGeocodeCourse(loc) {
    const key = String(mapConfig.amapKey || "").trim();
    if (!key) return null;
    const address = encodeURIComponent(
      `${loc.province || ""}${loc.city || ""}${loc.name}`.trim()
    );
    const city = encodeURIComponent(loc.city || loc.province || "");
    try {
      const resp = await fetch(
        `https://restapi.amap.com/v3/geocode/geo?address=${address}&city=${city}&key=${key}`
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.status !== "1" || !data.geocodes?.length) return null;
      const geo = data.geocodes[0];
      const [lng, lat] = (geo.location || "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      // 地理编码返回 GCJ02 → 转为 WGS84 存储
      const wgsCenter = gcj02ToWgs84(lat, lng);
      return {
        amapPoiName: geo.formatted_address || loc.name,
        courseMapCenter: wgsCenter,
        mapPrecision: "amap-geocode",
      };
    } catch {
      return null;
    }
  }

  function resolveCourseMapInfoWithAmap(AMap, loc) {
    if (!AMap?.PlaceSearch) {
      return new Promise((resolve) => {
        AMap.plugin?.("AMap.PlaceSearch", () => resolve(resolveCourseMapInfoWithAmap(AMap, loc)));
        if (!AMap.plugin) resolve(null);
      });
    }
    const cacheKey = loc.id || loc.name;
    if (amapCourseResolutionCache.has(cacheKey)) return Promise.resolve(amapCourseResolutionCache.get(cacheKey));

    const city = loc.city || loc.province || "";
    const keywords = buildSearchKeywords(loc);

    // 辅助：逐关键词搜索直到命中
    async function searchWithFallback() {
      // ── 第1轮：城市限定 + 精确关键词 ──
      for (const kw of keywords) {
        const pois = await searchAmapPOI(AMap, kw, city, true);
        const best = pickBestPoi(loc, pois);
        if (best) return best;
      }
      // ── 第2轮：全国范围 + 精确关键词 ──
      for (const kw of keywords) {
        const pois = await searchAmapPOI(AMap, kw, city, false);
        const best = pickBestPoi(loc, pois);
        if (best) return best;
      }
      // ── 第3轮：城市限定 + 城市名+高尔夫 泛搜 ──
      if (city) {
        const broadPois = await searchAmapPOI(AMap, `${city} 高尔夫`, city, true, 25);
        const broadBest = pickBestPoi(loc, broadPois);
        if (broadBest) return broadBest;
      }
      // ── 第4轮：地理编码兜底 ──
      const geocode = await tryGeocodeCourse(loc);
      if (geocode) return { poi: null, score: 100, location: geocode.courseMapCenter, geocodeInfo: geocode };
      return null;
    }

    return new Promise((resolve) => {
      searchWithFallback().then((best) => {
        if (!best) {
          amapCourseResolutionCache.set(cacheKey, null);
          resolve(null);
          return;
        }
        // 地理编码结果
        if (best.geocodeInfo) {
          amapCourseResolutionCache.set(cacheKey, best.geocodeInfo);
          resolve(best.geocodeInfo);
          return;
        }
        // POI 搜索结果
        const wgsCenter = gcj02ToWgs84(best.location.lat, best.location.lng);
        const info = {
          amapPoiName: best.poi.name || getCourseMapName(loc),
          courseMapCenter: wgsCenter,
          mapPrecision: "amap-poi",
        };
        amapCourseResolutionCache.set(cacheKey, info);
        resolve(info);
      }).catch(() => {
        amapCourseResolutionCache.set(cacheKey, null);
        resolve(null);
      });
    });
  }
  
  function getAmapPoiLocation(poi) {
    const location = poi?.location;
    if (!location) return null;
    const lng = Number(location.lng ?? location[0] ?? (typeof location.getLng === "function" ? location.getLng() : NaN));
    const lat = Number(location.lat ?? location[1] ?? (typeof location.getLat === "function" ? location.getLat() : NaN));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  
  function scoreAmapCoursePoi(loc, poi) {
    const name = String(poi?.name || "");
    const address = String(poi?.address || "");
    const type = String(poi?.type || "");
    const text = `${name} ${address} ${type}`;
    let score = 0;
    ["高尔夫", "球会", "球场", "俱乐部", "乡村"].forEach((token) => {
      if (text.includes(token)) score += 24;
    });
    const baseName = loc.name.replace(/高尔夫|俱乐部|球会|球场|国际|重庆|上海|北京|深圳|广州|成都|武汉|天津|南京|青岛|大连/g, "");
    if (baseName && text.includes(baseName)) score += 18;
    if (loc.city && text.includes(loc.city)) score += 6;
    if (loc.province && text.includes(loc.province)) score += 4;
    ["社区", "小区", "酒店", "公司", "学院", "产业园", "售楼", "公寓", "学校"].forEach((token) => {
      if (name.includes(token) && !name.includes("高尔夫")) score -= 30;
    });
  
    const poiLoc = getAmapPoiLocation(poi);
    if (poiLoc) {
      const expected = wgs84ToGcj02(getCourseMapCenter(loc).lat, getCourseMapCenter(loc).lng);
      const distance = Math.hypot((poiLoc.lng - expected.lng) * 96, (poiLoc.lat - expected.lat) * 111);
      if (distance <= 1.2) score += 14;
      else if (distance <= 6) score += 5;
      else score -= Math.min(24, distance * 1.5);
    }
    return score;
  }

  function loadAmapJsApi() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (amapLoaderPromise) return amapLoaderPromise;
    amapLoaderPromise = new Promise((resolve, reject) => {
      const key = String(mapConfig.amapKey || "").trim();
      if (!key) {
        reject(new Error("missing amap key"));
        return;
      }
      if (mapConfig.amapSecurityJsCode) {
        window._AMapSecurityConfig = { securityJsCode: mapConfig.amapSecurityJsCode };
      }
      const script = document.createElement("script");
      script.src = "https://webapi.amap.com/maps?v=2.0&key=" + encodeURIComponent(key);
      script.async = true;
      script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("amap unavailable"));
      script.onerror = () => reject(new Error("amap script failed"));
      document.head.appendChild(script);
    });
    return amapLoaderPromise;
  }

  async function applyAmapCourseResolution(index) {
    if (!hasAmapJsKey()) return null;
    const loc = golfLocations[index];
    if (!loc) return null;
    try {
      const AMap = await loadAmapJsApi();
      const info = await resolveCourseMapInfoWithAmap(AMap, loc);
      if (info) Object.assign(loc, info);
      return info;
    } catch {
      return null;
    }
  }
  
  function showCourseTerrainMode() {
    modelViewMode = "terrain";
    syncModelViewButtons();
    modelCanvas.style.visibility = "visible";
    modelGroup.visible = false;
    courseTerrainGroup.visible = true;
    modelControls.enabled = true;
    if (selectedCourseIndex !== null) {
      const index = selectedCourseIndex;
      if (hasAmapJsKey()) {
        applyAmapCourseResolution(index).finally(() => {
          if (selectedCourseIndex === index && modelViewMode === "terrain") updateCourseTerrainView(index);
        });
      } else {
        updateCourseTerrainView(index);
      }
    }
  }
  
  function showGenericModelMode() {
    modelViewMode = "model";
    syncModelViewButtons();
    modelCanvas.style.visibility = "visible";
    courseTerrainGroup.visible = false;
    modelGroup.visible = true;
    modelControls.enabled = true;
    if (selectedCourseIndex !== null) {
      const loc = golfLocations[selectedCourseIndex];
      prepareFallbackCourseModel(loc, "轻量球场预览，高清 3D 模型准备加载");
      loadGolfSceneModel(selectedCourseIndex).then((loaded) => {
        if (selectedCourseIndex === null || modelViewMode !== "model") return;
        modelLabel.textContent = loaded
          ? `${getCourseDisplayName(loc)} · 3D 球场模型`
          : `${getCourseDisplayName(loc)} · 3D 模型加载失败，已使用轻量球场预览`;
      });
    }
  }
  
  function getCourseModelUrl(index = selectedCourseIndex) {
    const loc = golfLocations[index];
    return loc?.model || DEFAULT_COURSE_MODEL_URL;
  }

  function getCourseModelSourceLabel(index = selectedCourseIndex) {
    return getCourseModelUrl(index) === DEFAULT_COURSE_MODEL_URL ? "通用模型" : "专属模型";
  }

  function prepareFallbackCourseModel(loc, message = "轻量球场预览") {
    clearModelGroupContents();
    modelHasFallback = false;
    createFallbackCourseModel();
    modelGroup.visible = true;
    courseTerrainGroup.visible = false;
    if (loc && modelLabel) modelLabel.textContent = `${getCourseDisplayName(loc)} · ${message}`;
  }

  function normalizeLoadedCourseScene(sceneObject) {
    sceneObject.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sceneObject);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 6.0;
    const scale = targetSize / maxDim;
    const center = box.getCenter(new THREE.Vector3());

    sceneObject.scale.setScalar(scale);
    sceneObject.position.set(-center.x * scale, -center.y * scale + 0.35, -center.z * scale);
    sceneObject.updateMatrixWorld(true);
    return sceneObject;
  }

  function cloneLoadedCourseScene(sceneTemplate) {
    const clone = sceneTemplate.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }

  function showLoadedCourseModel(sceneTemplate) {
    clearModelGroupContents();
    modelHasFallback = false;
    modelGroup.add(cloneLoadedCourseScene(sceneTemplate));
    modelGroup.visible = true;
    courseTerrainGroup.visible = false;
  }

  function createFallbackCourseModel() {
    if (modelHasFallback || modelGroup.children.length > 0) return;
    modelHasFallback = true;
  
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.9, 3.15, 0.18, 64),
      new THREE.MeshStandardMaterial({ color: 0x3f7c43, roughness: 0.88 })
    );
    base.position.y = -0.45;
    modelGroup.add(base);
  
    const fairwayMat = new THREE.MeshStandardMaterial({ color: 0x8fc86b, roughness: 0.74 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0xa8db7b, roughness: 0.62 });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c58c, roughness: 0.9 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x3c83a9, roughness: 0.42, metalness: 0.05 });
  
    for (let i = 0; i < 5; i++) {
      const fairway = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 12), fairwayMat);
      fairway.scale.set(1.7, 0.08, 0.42);
      fairway.position.set(-1.7 + i * 0.85, -0.3 + i * 0.015, Math.sin(i * 1.2) * 0.72);
      fairway.rotation.y = -0.35 + i * 0.18;
      modelGroup.add(fairway);
    }
  
    const water = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 12), waterMat);
    water.scale.set(1.4, 0.05, 0.48);
    water.position.set(1.05, -0.24, 0.72);
    water.rotation.y = 0.5;
    modelGroup.add(water);
  
    for (let i = 0; i < 4; i++) {
      const sand = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 8), sandMat);
      sand.scale.set(1.45, 0.05, 0.62);
      sand.position.set(-1.1 + i * 0.7, -0.21, -0.9 + Math.sin(i) * 0.24);
      sand.rotation.y = i * 0.7;
      modelGroup.add(sand);
    }
  
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 10), greenMat);
    green.scale.set(1.45, 0.06, 0.82);
    green.position.set(1.9, -0.19, -0.45);
    green.rotation.y = -0.4;
    modelGroup.add(green);
  }
  
  const loadingScreen = document.getElementById("loading-screen");
  const loadingPercent = document.getElementById("loading-percent");
  const loadingText = document.getElementById("loading-text");
  
  let gltfLoaderModulePromise = null;
  
  function hideInitialLoadingScreen() {
    if (!loadingScreen || loadingScreen.classList.contains("fade-out")) return;
    loadingText.textContent = "地图加载完成";
    loadingPercent.textContent = "100%";
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 620);
  }
  
  function clearModelGroupContents() {
    while (modelGroup.children.length) {
      const child = modelGroup.children[0];
      modelGroup.remove(child);
      disposeObject3D(child);
    }
  }
  
  function setModelLoadingLabel(index, pct) {
    if (selectedCourseIndex !== index || modelViewMode !== "model") return;
    const loc = golfLocations[index];
    if (!loc) return;
    const sourceLabel = getCourseModelSourceLabel(index);
    const progressText = Number.isFinite(pct) ? ` ${pct}%` : "";
    modelLabel.textContent = `${getCourseDisplayName(loc)} · ${sourceLabel}加载中${progressText}`;
  }
  
  function setModelLoadingMessage(index, message) {
    if (selectedCourseIndex !== index || modelViewMode !== "model") return;
    const loc = golfLocations[index];
    if (loc) modelLabel.textContent = `${getCourseDisplayName(loc)} · ${message}`;
  }
  
  function createModelLoadPromise(modelUrl) {
    gltfLoaderModulePromise ||= import("three/addons/loaders/GLTFLoader.js");
    const entry = { state: "loading", promise: null, scene: null, error: null };
    entry.promise = gltfLoaderModulePromise
      .then(({ GLTFLoader }) => new Promise((resolve, reject) => {
        const modelLoader = new GLTFLoader();
        modelLoader.load(
          modelUrl,
          (gltf) => {
            entry.scene = normalizeLoadedCourseScene(gltf.scene);
            entry.state = "loaded";
            resolve(entry.scene);
          },
          (xhr) => {
            if (typeof entry.onProgress === "function" && xhr.total > 0) {
              entry.onProgress(Math.min(99, Math.round((xhr.loaded / xhr.total) * 100)));
            }
          },
          (error) => {
            entry.state = "failed";
            entry.error = error;
            reject(error);
          }
        );
      }));
    courseModelCache.set(modelUrl, entry);
    return entry;
  }

  function loadGolfSceneModel(index = selectedCourseIndex) {
    const loc = golfLocations[index];
    if (!loc) return Promise.resolve(false);

    const modelUrl = getCourseModelUrl(index);
    const token = ++activeModelLoadToken;
    const cachedEntry = courseModelCache.get(modelUrl);

    if (cachedEntry?.state === "loaded" && cachedEntry.scene) {
      showLoadedCourseModel(cachedEntry.scene);
      setModelLoadingLabel(index, 100);
      return Promise.resolve(true);
    }

    let entry = cachedEntry;
    if (!entry || entry.state === "failed") {
      entry = createModelLoadPromise(modelUrl);
    }

    setModelLoadingLabel(index, 0);
    const slowTimer = window.setTimeout(() => {
      if (token === activeModelLoadToken && selectedCourseIndex === index && modelViewMode === "model") {
        setModelLoadingMessage(index, "高清 3D 球场模型加载中，先显示轻量球场预览");
      }
    }, 4000);

    entry.onProgress = (pct) => {
      if (token === activeModelLoadToken) setModelLoadingLabel(index, pct);
    };

    return entry.promise
      .then((sceneTemplate) => {
        if (token === activeModelLoadToken && selectedCourseIndex === index && modelViewMode === "model") {
          showLoadedCourseModel(sceneTemplate);
          setModelLoadingLabel(index, 100);
        }
        return true;
      })
      .catch((error) => {
        console.warn("Golf model failed to load, path:", modelUrl, error);
        if (token === activeModelLoadToken && selectedCourseIndex === index && modelViewMode === "model") {
          prepareFallbackCourseModel(loc, "3D 模型加载失败，已使用轻量球场预览");
        }
        reportPageResourceIssue(
          "球场 3D 模型加载失败",
          `资源 ${modelUrl} 没有成功加载，已自动切换为轻量球场预览。详情卡片和数字球童仍可正常使用。`
        );
        return false;
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
        if (entry.onProgress && token === activeModelLoadToken) entry.onProgress = null;
      });
  }
  
  requestAnimationFrame(() => {
    setTimeout(hideInitialLoadingScreen, isCompactViewport() ? 260 : 380);
  });
  
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.02;
  const mouse = new THREE.Vector2();
  const mouseDown = new THREE.Vector2();
  const mouseUp = new THREE.Vector2();
  const modelRaycaster = new THREE.Raycaster();
  const modelMouse = new THREE.Vector2();
  const modelMouseDown = new THREE.Vector2();
  const modelMouseUp = new THREE.Vector2();
  let lastModelFocusPoint = null;
  let modelZoomStep = 0;
  let modelCameraTween = null;
  let caddyRequestId = 0;
  
  
  const overlay = document.getElementById("overlay");
  const cardPanel = document.getElementById("card");
  const cardTitle = document.getElementById("card-title");
  const cardDesc = document.getElementById("card-desc");
  const cardClose = document.getElementById("card-close");
  const courseTerrain = document.getElementById("course-terrain");
  const courseEnvironment = document.getElementById("course-environment");
  const courseSummary = document.getElementById("course-summary");
  const weatherRiskCard = document.getElementById("weather-risk-card");
  const weatherRiskSummary = document.getElementById("weather-risk-summary");
  const weatherRiskDetail = document.getElementById("weather-risk-detail");
  const courseTabButtons = document.querySelectorAll(".course-tab");
  const courseTabPanel = document.getElementById("course-tab-panel");
  
  const caddyText = document.getElementById("caddy-text");
  const caddyBubble = document.getElementById("caddy-bubble");
  const modelLabel = document.getElementById("model-label");
  const caddyModeButtons = document.querySelectorAll(".caddy-mode");
  const caddyNote = document.getElementById("caddy-note");
  const caddyRuntimeStatus = document.getElementById("caddy-runtime-status");
  const caddyBagPanel = document.getElementById("caddy-bag-panel");
  const caddyBagStatus = document.getElementById("caddy-bag-status");
  const profileBagStatus = document.getElementById("profile-bag-status");
  const caddyBagInputs = document.querySelectorAll("[data-bag-club], [data-profile-bag-club]");
  const caddyBagSave = document.getElementById("caddy-bag-save");
  const caddyBagDefault = document.getElementById("caddy-bag-default");
  const caddyBagReset = document.getElementById("caddy-bag-reset");
  const profileBagSave = document.getElementById("profile-bag-save");
  const profileBagDefault = document.getElementById("profile-bag-default");
  const profileBagReset = document.getElementById("profile-bag-reset");
  const caddyAsk = document.getElementById("caddy-ask");
  const caddyCopy = document.getElementById("caddy-copy");
  const caddyAvatarImage = document.querySelector("#caddy-avatar img");
  const globeTooltip = document.createElement("div");
  globeTooltip.id = "globe-marker-tooltip";
  globeTooltip.setAttribute("role", "status");
  globeTooltip.setAttribute("aria-live", "polite");
  document.body.appendChild(globeTooltip);
  let selectedCaddyMode = "strategy";
  let latestCaddyAdviceText = "";
  let currentCourseWeather = null;
  let weatherRequestId = 0;
  let photoDetailVisible = false;
  let realViewDragging = false;
  let realViewStartX = 0;
  let realViewStartYaw = 0;
  let realViewYaw = 0;
  let hoveredGlobeIndex = null;
  let globePointerActive = false;
  let globePointerMoved = false;
  let globePointerType = "mouse";
  
  caddyAvatarImage?.addEventListener("error", () => {
    reportPageResourceIssue(
      "数字球童头像加载失败",
      "资源 ./assets/caddy_photo.png 没有成功加载。请确认 assets/caddy_photo.png 已上传到 GitHub Pages。"
    );
  });

  function updateCaddyBagStatus(saved = Boolean(readSavedCaddyBag()), estimated = !saved && !hasCaddyBagValues(getCurrentBagInputData())) {
    const text = saved ? "已保存" : estimated ? "估算中" : "未保存";
    [caddyBagStatus, profileBagStatus].forEach((statusEl) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle("saved", saved);
    });
  }

  function hydrateCaddyBagInputs() {
    const saved = normalizeBagData(readSavedCaddyBag() || {});
    const hasSaved = hasCaddyBagValues(saved);
    const estimated = normalizeBagData(estimateGolfBagFromDrive());
    caddyBagInputs.forEach((input) => {
      const key = getBagInputKey(input);
      if (!key) return;
      input.placeholder = key === "putter"
        ? "例如：长推容易短"
        : String(estimated[key] || "");
      input.value = hasSaved ? (saved[key] || "") : "";
    });
    updateCaddyBagStatus(hasSaved, !hasSaved);
  }

  function syncBagInputValue(key, value, sourceInput) {
    caddyBagInputs.forEach((input) => {
      if (input === sourceInput || getBagInputKey(input) !== key) return;
      input.value = value;
    });
  }

  function fillEstimatedCaddyBagInputs() {
    const estimated = normalizeBagData(estimateGolfBagFromDrive());
    localStorage.removeItem(CADDY_BAG_STORAGE_KEY);
    caddyBagInputs.forEach((input) => {
      const key = getBagInputKey(input);
      if (!key) return;
      input.value = estimated[key] || "";
    });
    updateCaddyBagStatus(false, true);
  }

  function refreshCaddyForBagChange() {
    if (selectedCourseIndex !== null && (selectedCaddyMode === "club" || selectedCaddyMode === "bag")) refreshCaddyAdvice();
  }

  function saveCaddyBag() {
    const data = getCurrentBagInputData();
    if (!hasCaddyBagValues(data)) {
      localStorage.removeItem(CADDY_BAG_STORAGE_KEY);
      hydrateCaddyBagInputs();
      return;
    }
    localStorage.setItem(CADDY_BAG_STORAGE_KEY, JSON.stringify(data));
    hydrateCaddyBagInputs();
    refreshCaddyForBagChange();
  }

  function clearCaddyBag() {
    localStorage.removeItem(CADDY_BAG_STORAGE_KEY);
    caddyBagInputs.forEach((input) => {
      input.value = "";
    });
    hydrateCaddyBagInputs();
    refreshCaddyForBagChange();
  }

  function restoreDefaultCaddyBag() {
    fillEstimatedCaddyBagInputs();
    refreshCaddyForBagChange();
  }

  caddyBagSave?.addEventListener("click", saveCaddyBag);
  caddyBagDefault?.addEventListener("click", restoreDefaultCaddyBag);
  caddyBagReset?.addEventListener("click", clearCaddyBag);
  profileBagSave?.addEventListener("click", saveCaddyBag);
  profileBagDefault?.addEventListener("click", restoreDefaultCaddyBag);
  profileBagReset?.addEventListener("click", clearCaddyBag);
  caddyBagInputs.forEach((input) => {
    input.addEventListener("input", () => {
      syncBagInputValue(getBagInputKey(input), input.value, input);
      const current = getCurrentBagInputData();
      const estimated = sameBagData(current, estimateGolfBagFromDrive());
      updateCaddyBagStatus(false, estimated);
    });
  });
  hydrateCaddyBagInputs();
  if (isGithubPagesStaticHost() && getConfiguredCaddyMode() === "local") {
    updateCaddyRuntimeStatus("basic", "线上不调用 localhost");
  } else if (isGithubPagesStaticHost() && getConfiguredCaddyMode() === "cloud" && isRelativeEndpoint(appConfig.cloudEndpoint || DEFAULT_CLOUD_CADDY_ENDPOINT)) {
    updateCaddyRuntimeStatus("cloud", "云端球童服务未配置");
  } else {
    updateCaddyRuntimeStatus(getConfiguredCaddyMode(), getConfiguredCaddyMode() === "local" ? "等待连接" : "");
  }
  
  modelTerrainToggle?.addEventListener("click", showCourseTerrainMode);
  modelGenericToggle?.addEventListener("click", showGenericModelMode);
  
  function getCourseVideoSrc(index) {
    const loc = golfLocations[index];
    return loc?.realviewVideo || loc?.panoVideo || "";
  }
  
  function getRealviewSourceLabel(loc) {
    if (!loc?.realviewVideo && !loc?.panoVideo) return "未配置本地实景";
    if (loc.demoCourseRealview || loc.realviewType === "demo") return "本地演示实景视频";
    if (loc.panoVideo) return "真实 360 全景视频";
    return "真实实景视频";
  }

  function getRealviewNote(loc) {
    if (!loc?.realviewVideo && !loc?.panoVideo) {
      return "本地实景仅展示已授权/已配置素材；当前球场未配置本地实景，可打开高德地图查看公开地图。";
    }
    if (loc.realviewNote) return loc.realviewNote;
    if (loc.demoCourseRealview || loc.realviewType === "demo") {
      return "本地实景仅展示已授权/已配置素材；当前视频为明确配置的演示素材，不代表所有球场都有真实实拍。";
    }
    return "本地实景仅展示已授权/已配置素材。";
  }

  function applyRealViewYaw() {
    const shift = Math.sin(realViewYaw) * 10;
    const scale = 1.16 + Math.abs(Math.cos(realViewYaw)) * 0.03;
    if (photoDetailVideo) photoDetailVideo.style.transform = `scale(${scale}) translateX(${shift}%)`;
    if (photoDetailImage) photoDetailImage.style.transform = `scale(${scale}) translateX(${shift * 0.45}%)`;
  }
  
  function hideOverlay() {
    caddyRequestId += 1;
    terrainLoadToken += 1;
    hidePhotoDetail();
    modelCanvas.style.visibility = "visible";
    selectedCourseIndex = null;
    updateGlobeMarkers();
    overlay.classList.remove("visible");
    document.body.classList.remove("overlay-open");
  }
  
  function easeOutCubic(p) {
    return 1 - Math.pow(1 - p, 3);
  }
  
  function easeInOutCubic(p) {
    return p < 0.5
      ? 4 * p * p * p
      : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
  
  function focusModelAtPoint(point) {
    modelLabel.textContent = selectedCourseIndex === null
      ? "已聚焦到球场局部区域"
      : `${getCourseDisplayName(golfLocations[selectedCourseIndex])} · 已聚焦到球场局部区域`;
    const distances = [4.6, 2.35, 1.05];
    const sameArea = lastModelFocusPoint && lastModelFocusPoint.distanceTo(point) < 2.4;
    modelZoomStep = sameArea ? Math.min(modelZoomStep + 1, distances.length - 1) : 0;
    lastModelFocusPoint = point.clone();
  
    const currentOffset = modelCamera.position.clone().sub(modelControls.target);
    const direction = currentOffset.lengthSq() > 0.0001
      ? currentOffset.normalize()
      : new THREE.Vector3(0.55, 0.6, 0.55).normalize();
  
    modelCameraTween = {
      startTime: performance.now(),
      duration: 680,
      fromPosition: modelCamera.position.clone(),
      fromTarget: modelControls.target.clone(),
      toPosition: point.clone().add(direction.multiplyScalar(distances[modelZoomStep])),
      toTarget: point.clone(),
      revealPhoto: false,
    };
  }
  
  function updateModelCameraTween() {
    if (!modelCameraTween) return;
  
    const elapsed = performance.now() - modelCameraTween.startTime;
    const p = Math.min(elapsed / modelCameraTween.duration, 1);
    const t = easeOutCubic(p);
  
    modelCamera.position.lerpVectors(modelCameraTween.fromPosition, modelCameraTween.toPosition, t);
    modelControls.target.lerpVectors(modelCameraTween.fromTarget, modelCameraTween.toTarget, t);
  
    if (p >= 1) {
      const shouldRevealPhoto = modelCameraTween.revealPhoto;
      modelCameraTween = null;
      if (shouldRevealPhoto) showPhotoDetail();
    }
  }
  
  function createFallbackPhoto(loc) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const ctx = canvas.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#c7e4f2");
    sky.addColorStop(0.38, "#7fb2a4");
    sky.addColorStop(1, "#315f33");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.save();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.62);
    ctx.rotate(-0.16);
    ctx.fillStyle = "#6fb55b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 560, 210, 0, 0, Math.PI * 2);
    ctx.fill();
  
    ctx.fillStyle = "#93cf79";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(-470 + i * 160, Math.sin(i) * 42, 120, 42, Math.sin(i) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  
    ctx.fillStyle = "#345d86";
    ctx.beginPath();
    ctx.ellipse(230, 35, 145, 54, 0.22, 0, Math.PI * 2);
    ctx.fill();
  
    ctx.fillStyle = "#e6d8a8";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-330 + i * 150, 70 + Math.sin(i) * 32, 52, 22, i * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  
    const vignette = ctx.createRadialGradient(600, 380, 120, 600, 380, 760);
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "700 38px Microsoft YaHei, sans-serif";
    ctx.fillText(getCourseDisplayName(loc), 44, 72);
    ctx.font = "24px Microsoft YaHei, sans-serif";
    ctx.fillText(`${loc.tags.terrain} · ${loc.tags.skill}`, 44, 112);
    return canvas.toDataURL("image/png");
  }
  
  function showPhotoDetail() {
    if (selectedCourseIndex === null) return;
    const loc = golfLocations[selectedCourseIndex];
    const videoSrc = getCourseVideoSrc(selectedCourseIndex);
  
    let src = "";
    try {
      modelControls.update();
      modelRenderer.render(modelScene, modelCamera);
      src = modelCanvas.toDataURL("image/png");
    } catch {
      src = createFallbackPhoto(loc);
    }
  
    photoDetailImage.src = src || createFallbackPhoto(loc);
    if (!videoSrc) {
      photoDetailVideo.style.display = "none";
      photoDetailTitle.textContent = `${getCourseDisplayName(loc)} · 3D 近景快照`;
      photoDetailMeta.textContent = `${getRealviewNote(loc)} 下方画面为 3D 近景快照，不是实拍图。`;
      photoDetail.classList.add("visible");
      photoDetail.setAttribute("aria-hidden", "false");
      photoDetailVisible = true;
      modelControls.enabled = false;
      return;
    }
  
    photoDetailVideo.src = videoSrc;
    photoDetailVideo.poster = photoDetailImage.src;
    photoDetailVideo.style.display = "block";
    try {
      photoDetailVideo.currentTime = 0;
    } catch {
      // Metadata may not be ready yet; playback still starts from the beginning for a new src.
    }
    realViewYaw = 0;
    applyRealViewYaw();
    photoDetailVideo.load();
    photoDetailVideo.play().catch(() => {});
    photoDetailTitle.textContent = `${getCourseDisplayName(loc)} · ${getRealviewSourceLabel(loc)}`;
    photoDetailMeta.textContent = `${getRealviewNote(loc)} 封面来自 3D 近景快照；按住视频水平拖动，可模拟以自我为中心的 360 度观察。`;
    photoDetail.classList.add("visible");
    photoDetail.setAttribute("aria-hidden", "false");
    photoDetailVisible = true;
    modelControls.enabled = false;
  }
  
  function hidePhotoDetail() {
    if (!photoDetail) return;
    photoDetail.classList.remove("visible");
    photoDetail.setAttribute("aria-hidden", "true");
    photoDetailVisible = false;
    if (photoDetailVideo) {
      photoDetailVideo.pause();
      photoDetailVideo.removeAttribute("src");
      photoDetailVideo.load();
    }
    if (modelControls) modelControls.enabled = true;
  }
  
  function getAmapCourseUrl(loc) {
    const courseCenter = getCourseMapCenter(loc);
    const name = encodeURIComponent(getCourseMapName(loc));
    const city = encodeURIComponent(loc.city || loc.province || "");
    if (!isCourseMapVerified(loc)) {
      const keyword = encodeURIComponent(getCourseMapKeyword(loc));
      return `https://uri.amap.com/search?keyword=${keyword}&city=${city}&src=3d-golf&callnative=0`;
    }
    return `https://uri.amap.com/marker?position=${courseCenter.lng.toFixed(6)},${courseCenter.lat.toFixed(6)}&name=${name}&src=3d-golf&dev=1&callnative=0&city=${city}`;
  }
  
  function openAmapCourseMap() {
    if (selectedCourseIndex === null) return;
    const loc = golfLocations[selectedCourseIndex];
    const url = loc.externalMapUrl || loc.amapUrl || getAmapCourseUrl(loc);
    const nextWindow = window.open(url, "_blank");
    if (nextWindow) nextWindow.opener = null;
    if (!nextWindow && courseTabPanel) {
      courseTabPanel.insertAdjacentHTML(
        "beforeend",
        `<p class="course-provider-note">浏览器拦截了新窗口，请允许弹窗后再次点击“打开高德地图”。</p>`
      );
    }
  }
  
  function getCourseDescription(loc) {
    const parts = [loc.description];
    if (userProfile) {
      const match = calculateMatch(userProfile, loc);
      parts.push(`匹配度 ${match.finalScore}%，难度 ${loc.difficulty || loc.tags.skill}，类型 ${loc.courseType || loc.tags.terrain}，核心风格：${loc.tags.strategy} / ${loc.tags.terrain} / ${loc.tags.environment}。`);
    }
    parts.push(`主要障碍：${formatList(loc.hazards)}。适合：${formatList(loc.bestFor)}。`);
    const distance = formatDistance(getCourseDistance(loc));
    if (distance) parts.push(`当前位置距离约 ${distance}。`);
    return parts.join(" ");
  }
  
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function formatList(value, fallback = "待确认") {
    if (Array.isArray(value) && value.length) return value.filter(Boolean).join("、");
    if (typeof value === "string" && value.trim()) return value.trim();
    return fallback;
  }

  function getWeatherAdviceText(weather = currentCourseWeather) {
    if (!weather?.available) return "";
    return `${weather.caddyBrief} `;
  }

  function renderWeatherRisk(weather, state = "ready") {
    if (!weatherRiskCard || !weatherRiskSummary || !weatherRiskDetail) return;
    weatherRiskCard.classList.remove("loading", "unavailable", "risk-low", "risk-medium", "risk-high");

    if (appConfig.weatherMode === "disabled") {
      weatherRiskCard.hidden = true;
      return;
    }

    weatherRiskCard.hidden = false;
    if (state === "loading") {
      weatherRiskCard.classList.add("loading");
      weatherRiskSummary.textContent = `正在获取实时天气 · ${getWeatherModeLabel(appConfig)}`;
      weatherRiskDetail.textContent = "天气数据只用于本地打球风险提示，不会影响球场详情加载。";
      return;
    }

    if (!weather) {
      weatherRiskCard.classList.add("unavailable");
      weatherRiskSummary.textContent = "天气数据暂不可用";
      weatherRiskDetail.textContent = "天气接口未返回数据，数字球童会继续使用球场地形和用户档案给出建议。";
      return;
    }

    if (!weather.available) {
      weatherRiskCard.classList.add("unavailable");
      weatherRiskSummary.textContent = weather.summary || "天气数据暂不可用";
      weatherRiskDetail.textContent = weather.mode === "amapWeather"
        ? "网络异常或 API 不可达，已切换本地兜底。数字球童会继续使用球场地形和用户档案给出建议。"
        : "未配置真实 API Key 时不会请求外部天气接口，页面和数字球童可继续正常使用。";
      return;
    }

    const riskClass = weather.riskLevel === "高" ? "risk-high" : weather.riskLevel === "中" ? "risk-medium" : "risk-low";
    weatherRiskCard.classList.add(riskClass);

    // 高德实时天气：展示城市、天气现象、温度、风向风力
    const cityText = weather.city || "";
    const condText = weather.condition || "";
    const tempText = weather.temperature !== undefined ? `${weather.temperature}°C` : "";
    const windText = (weather.windDirection || weather.windPower)
      ? `${weather.windDirection || ""}风${weather.windPower || ""}`.trim()
      : "";
    const headerParts = [cityText, condText, tempText, windText, `风险${weather.riskLevel}`].filter(Boolean);
    weatherRiskSummary.textContent = headerParts.join(" · ");

    const detailParts = [];
    if (weather.humidity !== undefined && weather.humidity > 0) {
      detailParts.push(`湿度 ${weather.humidity}%`);
    }
    if (weather.updatedAt) {
      detailParts.push(`更新于 ${weather.updatedAt}`);
    }
    if (weather.risks?.length) {
      detailParts.push(weather.risks.join(" "));
    } else {
      detailParts.push("天气风险较低，可按正常节奏准备。");
    }
    weatherRiskDetail.textContent = detailParts.join(" · ");
  }

  function loadCourseWeather(index) {
    const loc = golfLocations[index];
    const requestId = ++weatherRequestId;
    currentCourseWeather = null;

    if (!loc || appConfig.weatherMode === "disabled") {
      renderWeatherRisk(null);
      return Promise.resolve(null);
    }

    renderWeatherRisk(null, "loading");
    return getCourseWeather(loc, appConfig)
      .then((weather) => {
        if (requestId !== weatherRequestId || selectedCourseIndex !== index) return null;
        currentCourseWeather = weather;
        renderWeatherRisk(weather);
        return weather;
      })
      .catch((error) => {
        console.warn("Weather risk failed:", error);
        if (requestId !== weatherRequestId || selectedCourseIndex !== index) return null;
        currentCourseWeather = null;
        renderWeatherRisk(null);
        return null;
      });
  }

  function parseCaddySections(advice) {
    const text = String(advice || "").trim();
    if (!text) return [];
    const matches = [...text.matchAll(/【([^】]+)】\s*([\s\S]*?)(?=【[^】]+】|$)/g)];
    if (matches.length) {
      return matches.map((match) => ({
        title: match[1].trim(),
        body: match[2].trim(),
      })).filter((item) => item.body);
    }
    return text.split(/\n{2,}/).map((part, index) => ({
      title: index === 0 ? "球童建议" : `补充 ${index + 1}`,
      body: part.trim(),
    })).filter((item) => item.body);
  }

  function renderCaddyAdvice(advice, { source = "" } = {}) {
    latestCaddyAdviceText = String(advice || "").trim();
    const sections = parseCaddySections(latestCaddyAdviceText);
    caddyText.innerHTML = sections.map((section) => `
      <section class="caddy-advice-card">
        <strong>${escapeHtml(section.title)}</strong>
        <p>${escapeHtml(section.body)}</p>
      </section>
    `).join("") || `<section class="caddy-advice-card"><strong>球童建议</strong><p>暂无建议内容。</p></section>`;
    if (source) {
      caddyText.insertAdjacentHTML("beforeend", `<span class="caddy-source">${escapeHtml(source)}</span>`);
    }
  }

  function scrollCaddyResultIntoView() {
    if (!cardPanel || !caddyBubble) return;
    const cardRect = cardPanel.getBoundingClientRect();
    const bubbleRect = caddyBubble.getBoundingClientRect();
    const targetTop = Math.max(0, cardPanel.scrollTop + bubbleRect.top - cardRect.top - 18);
    cardPanel.scrollTo({
      top: targetTop,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }
  
  function renderCourseTab(tabName = "terrain") {
    if (selectedCourseIndex === null || !courseTabPanel) return;
    const loc = golfLocations[selectedCourseIndex];
    courseTabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.courseTab === tabName);
    });
  
    if (tabName === "environment") {
      courseTabPanel.innerHTML = `
        <strong>${escapeHtml(loc.city || loc.province || "中国球场")}</strong>
        <p>${escapeHtml(loc.environmentLabel || loc.tags.environment)} · ${escapeHtml(loc.description)}</p>
      `;
      return;
    }
  
    if (tabName === "info") {
      courseTabPanel.innerHTML = `
        <strong>${escapeHtml(getCourseDisplayName(loc))}</strong>
        <p>${escapeHtml(loc.province || "中国")} ${escapeHtml(loc.city || "")} · ${loc.holes || 18} 洞 · Par ${loc.par || 72}</p>
        <div class="course-info-grid">
          <span><b>地址</b>${escapeHtml(loc.address || "待确认")}</span>
          <span><b>难度</b>${escapeHtml(loc.difficulty || "待确认")}</span>
          <span><b>定位</b>${escapeHtml(loc.priceLevel || "待确认")}</span>
          <span><b>类型</b>${escapeHtml(loc.courseType || "待确认")}</span>
          <span><b>主要障碍</b>${escapeHtml(formatList(loc.hazards))}</span>
          <span><b>适合人群</b>${escapeHtml(formatList(loc.bestFor))}</span>
          <span><b>草种</b>${escapeHtml(loc.grassType || "待确认")}</span>
          <span><b>果岭速度</b>${escapeHtml(loc.greenSpeed || "待确认")}</span>
        </div>
      `;
      return;
    }
  
    if (tabName === "realview") {
      const videoSrc = getCourseVideoSrc(selectedCourseIndex);
      const hasVideo = Boolean(videoSrc);
      const verified = isCourseMapVerified(loc);
      const sourceLabel = getRealviewSourceLabel(loc);
      const buttonText = hasVideo
        ? (loc.demoCourseRealview || loc.realviewType === "demo" ? "播放演示实景" : "播放本地实景")
        : "暂无本地实景";
      courseTabPanel.innerHTML = `
        <strong>外部地图 / 本地实景 / 3D 近景快照</strong>
        <p>${verified ? "当前球场已使用校准坐标。" : "当前球场使用估算坐标。"} 本地实景仅展示已授权/已配置素材；未配置时可打开高德地图查看公开地图。</p>
        <p>当前本地实景状态：${escapeHtml(sourceLabel)}。3D 近景快照来自当前模型视角，不是实拍图。</p>
        <div class="course-action-row">
          <button class="course-realview-button" id="course-amap-open" type="button">打开高德地图</button>
          <button class="course-realview-button" id="course-realview-open" type="button" ${hasVideo ? "" : "disabled"}>${buttonText}</button>
        </div>
      `;
      return;
    }
  
    courseTabPanel.innerHTML = `
      <div class="terrain-mini" aria-hidden="true"></div>
      <p>${escapeHtml(loc.terrainLabel || loc.tags.terrain)} · 二维地图已改为高德/标准地图瓦片底图，缩放时按 zoom 级别重新加载高清底图，球场策略图层叠加显示。</p>
    `;
  }
  
  function refreshCaddyAdvice() {
    if (selectedCourseIndex === null) return;
  
    const loc = golfLocations[selectedCourseIndex];
    const note = caddyNote.value.trim();
    const requestId = ++caddyRequestId;
    const caddyWaitHint = getConfiguredCaddyMode() === "local"
      ? "本地模型首次加载可能需要 30-90 秒，请稍候；完成后会自动显示在这里。"
      : "数字球童正在结合档案、球场、距离、天气、球包和现场补充重新分析...";
    caddyText.innerHTML = `
      <section class="caddy-advice-card loading">
        <strong>正在分析</strong>
        <p>${escapeHtml(caddyWaitHint)}</p>
      </section>
    `;
    updateCaddyRuntimeStatus(getConfiguredCaddyMode(), "准备分析");
    caddyBubble.scrollTop = 0;
    scrollCaddyResultIntoView();
  
    getCaddyAdviceFromLLM(loc, selectedCaddyMode, note).then((advice) => {
      if (requestId === caddyRequestId) {
        renderCaddyAdvice(advice);
        requestAnimationFrame(() => {
          caddyBubble.scrollTop = 0;
          scrollCaddyResultIntoView();
        });
      }
    }).catch(() => {
      if (requestId !== caddyRequestId) return;
      renderCaddyAdvice(`${getCaddyAdvice(loc, selectedCaddyMode, note)}\n【来源】数字球童请求异常，已切换基础建议。`);
      updateCaddyRuntimeStatus("basic", "请求异常，已回退");
      requestAnimationFrame(scrollCaddyResultIntoView);
    });
  }
  
  function openCourse(index, options = {}) {
    const loc = golfLocations[index];
    if (!loc) return;
  
    if (options.fly && !options.skipFly) {
      if (isTransitioning || mapState.clickLocked) return;
      isTransitioning = true;
      mapState.clickLocked = true;
      mapState.selectedIndex = index;
      pulseGlobeMarker(index);
      listPanel.classList.remove("visible");
      listPanel.setAttribute("aria-hidden", "true");
      hideMapRegionPanel();
      if (overlay.classList.contains("visible")) hideOverlay();
  
      if (mapDetailVisible) {
        renderDetailMapNow();
        animateMapToCourse(index, {
          scale: Math.max(mapState.scale, 4.2),
          onComplete: () => {
            showTransition(`正在进入 ${getCourseDisplayName(loc)}`);
            window.setTimeout(() => {
              openCourse(index, { skipFly: true, fromMap: true });
              hideTransition();
              mapState.clickLocked = false;
              viewMode = "map";
              unlockTransition();
            }, prefersReducedMotion ? 80 : 340);
          },
        });
        return;
      }
  
      showTransition(`正在进入 ${getCourseDisplayName(loc)}`);
      const didFly = flyToCourse(index, options.distance || 1.55, () => {
        openCourse(index, { skipFly: true, fromGlobe: true });
        setTimeout(hideTransition, 240);
        mapState.clickLocked = false;
        viewMode = "globe";
        unlockTransition(120);
      });
      if (!didFly) {
        openCourse(index, { skipFly: true });
        setTimeout(hideTransition, 240);
        mapState.clickLocked = false;
        unlockTransition(120);
      }
      return;
    }
  
    selectedCourseIndex = index;
    updateGlobeMarkers();
    selectedCaddyMode = "strategy";
    caddyModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.caddyMode === selectedCaddyMode);
    });
    hidePhotoDetail();
    lastModelFocusPoint = null;
    modelZoomStep = 0;
    modelCameraTween = null;
  
    cardTitle.textContent = getCourseDisplayName(loc);
    cardDesc.textContent = getCourseDescription(loc);
    courseTerrain.textContent = loc.terrainLabel || loc.tags.terrain;
    courseEnvironment.textContent = loc.environmentLabel || loc.tags.environment;
    courseSummary.textContent = `${loc.city || loc.province || "中国"} · ${loc.holes || 18}洞 · Par ${loc.par || 72}`;
    modelLabel.textContent = getCourseDisplayName(loc);
    listPanel.classList.remove("visible");
    listPanel.setAttribute("aria-hidden", "true");
    overlay.classList.add("visible");
    document.body.classList.add("overlay-open");
    modelRotationEnabled = true;
    syncModelRotationMode();
    showCourseTerrainMode();
    renderCourseTab("terrain");

    caddyText.innerHTML = `
      <section class="caddy-advice-card loading">
        <strong>正在分析</strong>
        <p>数字球童正在结合档案、球场、距离与天气风险分析...</p>
      </section>
    `;
    caddyBubble.scrollTop = 0;
    loadCourseWeather(index).finally(() => {
      if (selectedCourseIndex === index) refreshCaddyAdvice();
    });
    requestAnimationFrame(() => requestAnimationFrame(updateModelRendererSize));
  }
  
  caddyModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedCaddyMode = button.dataset.caddyMode;
      if (selectedCaddyMode === "bag" && caddyBagPanel) caddyBagPanel.open = true;
      caddyModeButtons.forEach((item) => item.classList.toggle("active", item === button));
      refreshCaddyAdvice();
    });
  });
  
  courseTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      renderCourseTab(button.dataset.courseTab);
    });
  });
  
  courseTabPanel.addEventListener("click", (e) => {
    const amapButton = e.target.closest("#course-amap-open");
    if (amapButton) {
      openAmapCourseMap();
      return;
    }
    const realviewButton = e.target.closest("#course-realview-open");
    if (!realviewButton || realviewButton.disabled) return;
    showPhotoDetail();
  });
  
  caddyAsk.addEventListener("click", refreshCaddyAdvice);

  caddyCopy?.addEventListener("click", async () => {
    const text = latestCaddyAdviceText || caddyText.textContent.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      caddyCopy.textContent = "已复制";
      window.setTimeout(() => {
        caddyCopy.textContent = "复制建议";
      }, 1100);
    } catch {
      caddyCopy.textContent = "复制失败";
      window.setTimeout(() => {
        caddyCopy.textContent = "复制建议";
      }, 1100);
    }
  });
  
  cardClose.addEventListener("click", (e) => {
    e.stopPropagation();
    hideOverlay();
  });
  
  photoDetailClose.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePhotoDetail();
  });
  
  photoDetailVideo.addEventListener("pointerdown", (e) => {
    realViewDragging = true;
    realViewStartX = e.clientX;
    realViewStartYaw = realViewYaw;
    photoDetailVideo.setPointerCapture(e.pointerId);
  });
  
  photoDetailVideo.addEventListener("pointermove", (e) => {
    if (!realViewDragging) return;
    realViewYaw = realViewStartYaw + (e.clientX - realViewStartX) * 0.006;
    applyRealViewYaw();
  });
  
  photoDetailVideo.addEventListener("pointerup", () => {
    realViewDragging = false;
  });
  
  photoDetailVideo.addEventListener("pointercancel", () => {
    realViewDragging = false;
  });
  
  photoDetailVideo.addEventListener("pointerleave", () => {
    realViewDragging = false;
  });
  
  photoDetailVideo.addEventListener("error", () => {
    photoDetailVideo.style.display = "none";
    if (photoDetailVisible) {
      const src = selectedCourseIndex === null ? "" : getCourseVideoSrc(selectedCourseIndex);
      reportPageResourceIssue(
        "实景视频加载失败",
        `视频资源 ${src || "./assets/course_realview_*.mp4"} 没有成功加载。请确认对应 mp4 文件已上传到 assets 目录。`
      );
    }
  });

  function getGlobeClickableObjects() {
    return markers.flatMap((m) => {
      const objects = [m.hit, m.dot];
      if (m.pillar) objects.push(m.pillar);
      return objects;
    });
  }

  function findGlobeMarkerAt(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getGlobeClickableObjects(), false);
    if (!hits.length) return null;
    const idx = hits[0].object.userData.index;
    return markers[idx]?.hit.visible ? idx : null;
  }

  function getGlobeTooltipText(index) {
    const loc = golfLocations[index];
    if (!loc) return "";
    const location = [loc.province, loc.city].filter(Boolean).join(" · ") || "中国";
    const match = userProfile ? `${calculateMatch(userProfile, loc).finalScore}%` : "建档后计算";
    const badges = [
      markers[index]?.recommended ? "推荐" : null,
      markers[index]?.nearby ? "附近" : null,
      markers[index]?.realview ? "有实景" : null,
      markers[index]?.model ? "独立模型" : null,
    ].filter(Boolean).join(" · ");
    return `
      <strong>${escapeHtml(getCourseDisplayName(loc))}</strong>
      <span>${escapeHtml(location)} · 匹配 ${escapeHtml(match)}</span>
      ${badges ? `<em>${escapeHtml(badges)}</em>` : ""}
    `;
  }

  function showGlobeTooltip(index, clientX = 0, clientY = 0) {
    if (index === null || index === undefined) {
      globeTooltip.classList.remove("visible");
      hoveredGlobeIndex = null;
      return;
    }
    hoveredGlobeIndex = index;
    globeTooltip.innerHTML = getGlobeTooltipText(index);
    globeTooltip.style.left = `${Math.min(window.innerWidth - 190, clientX + 14)}px`;
    globeTooltip.style.top = `${Math.max(78, clientY - 16)}px`;
    globeTooltip.classList.add("visible");
  }

  function updateGlobeHover(clientX, clientY) {
    if (viewMode !== "globe" || mapDetailVisible || isTransitioning) {
      showGlobeTooltip(null);
      return;
    }
    const index = findGlobeMarkerAt(clientX, clientY);
    if (index !== hoveredGlobeIndex) showGlobeTooltip(index, clientX, clientY);
    else if (index !== null) showGlobeTooltip(index, clientX, clientY);
  }

  function updateGlobeMarkerPresentation(time) {
    const cameraDistance = camera.position.length();
    const farLevel = cameraDistance > 5.2 ? 2 : cameraDistance > 3.35 ? 1 : 0;
    const cameraDir = camera.position.clone().normalize();

    markers.forEach((m, i) => {
      const loc = golfLocations[i];
      const selected = selectedCourseIndex === i;
      const hovered = hoveredGlobeIndex === i;
      const priority = selected || hovered || m.recommended || m.nearby || m.realview || m.model;
      const onFrontSide = m.basePos.clone().normalize().dot(cameraDir) > -0.03;
      const spreadBucket = (i * 37 + Math.round(loc.lat * 10) + Math.round(loc.lng * 10)) % 5;
      const clusteredOut = !priority && ((farLevel === 2 && spreadBucket !== 0) || (farLevel === 1 && spreadBucket > 2));
      const visible = viewMode === "globe" && onFrontSide && !clusteredOut;
      const distanceScale = farLevel === 2 ? 0.62 : farLevel === 1 ? 0.82 : 1;
      const pulse = 1 + Math.sin(time * (m.recommended ? 4.1 : 2.5) + i) * (m.recommended ? 0.14 : 0.04);
      const clickPulse = m.clickPulseUntil && performance.now() < m.clickPulseUntil
        ? 1 + Math.sin(time * 22) * 0.18 + 0.24
        : 1;
      const base = selected ? 1.7 : hovered ? 1.45 : m.recommended ? 1.18 : m.nearby ? 1.04 : m.model ? 0.95 : 0.82;
      const scale = base * pulse * clickPulse * distanceScale;

      m.dot.visible = visible;
      m.hit.visible = visible;
      m.glow.visible = visible;
      m.nearbyRing.visible = visible && (m.nearby || selected || hovered);
      m.cameraBadge.visible = visible && m.realview && farLevel < 2;
      m.modelRing.visible = visible && m.model && (farLevel < 2 || selected || hovered || m.recommended);
      if (m.pillar) m.pillar.visible = visible && selected;

      m.dot.scale.setScalar(scale);
      m.hit.scale.setScalar(Math.max(1, 1.35 / Math.max(distanceScale, 0.6)));
      m.glow.scale.set(0.022 * scale * (m.recommended ? 1.28 : 1), 0.022 * scale * (m.recommended ? 1.28 : 1), 1);
      m.nearbyRing.scale.set(0.04 * scale, 0.04 * scale, 1);
      m.cameraBadge.scale.set(0.016 * Math.max(0.9, scale), 0.016 * Math.max(0.9, scale), 1);
      m.modelRing.scale.set(0.052 * scale * (hovered || selected ? 1.12 : 1), 0.052 * scale * (hovered || selected ? 1.12 : 1), 1);

      const opacityFactor = farLevel === 2 && !priority ? 0.4 : 1;
      m.glowMat.opacity = (selected ? 0.88 : m.recommended ? 0.58 : m.nearby ? 0.36 : 0.16) * opacityFactor;
      m.nearbyRingMat.opacity = visible && (m.nearby || selected || hovered) ? (selected ? 0.72 : hovered ? 0.62 : 0.42) : 0;
      m.cameraBadgeMat.opacity = visible && m.realview && farLevel < 2 ? 0.86 : 0;
      m.modelRingMat.opacity = visible && m.model ? (selected ? 0.52 : hovered ? 0.48 : farLevel === 2 ? 0 : 0.32) : 0;
    });
  }
  
  renderer.domElement.addEventListener("pointerdown", (e) => {
    mouseDown.set(e.clientX, e.clientY);
    globePointerActive = true;
    globePointerMoved = false;
    globePointerType = e.pointerType || "mouse";
    if (e.pointerType === "touch") updateGlobeHover(e.clientX, e.clientY);
  });

  renderer.domElement.addEventListener("pointermove", (e) => {
    if (globePointerActive && mouseDown.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > (globePointerType === "touch" ? 14 : 8)) {
      globePointerMoved = true;
      showGlobeTooltip(null);
      return;
    }
    if (e.pointerType !== "touch") updateGlobeHover(e.clientX, e.clientY);
  });
  
  renderer.domElement.addEventListener("wheel", (e) => {
    if (e.deltaY < 0) requestMapDetailAfterZoom();
  }, { passive: true });
  
  renderer.domElement.addEventListener("pointerup", (e) => {
    mouseUp.set(e.clientX, e.clientY);
    const movedDistance = mouseDown.distanceTo(mouseUp);
    const clickThreshold = e.pointerType === "touch" ? 14 : 8;
    globePointerActive = false;
    if (
      globePointerMoved
      || movedDistance > clickThreshold
      || (movedDistance > 2 && performance.now() - lastEarthInteractionEnd < 90)
    ) {
      return;
    }

    const idx = findGlobeMarkerAt(e.clientX, e.clientY);
    if (idx !== null) {
      showGlobeTooltip(idx, e.clientX, e.clientY);
      openCourse(idx, { fly: true, distance: 1.42 });
    } else {
      hideOverlay();
    }
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    globePointerActive = false;
    showGlobeTooltip(null);
  });

  renderer.domElement.addEventListener("pointercancel", () => {
    globePointerActive = false;
    globePointerMoved = false;
    showGlobeTooltip(null);
  });
  
  modelCanvas.addEventListener("pointerdown", (e) => {
    modelMouseDown.set(e.clientX, e.clientY);
    modelIsDragging = true;
  });
  
  modelCanvas.addEventListener("pointerup", (e) => {
    modelIsDragging = false;
    if (photoDetailVisible) return;
    modelMouseUp.set(e.clientX, e.clientY);
    if (modelMouseDown.distanceTo(modelMouseUp) > 4) return;
  
    const rect = modelCanvas.getBoundingClientRect();
    modelMouse.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    modelMouse.y = -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  
    modelRaycaster.setFromCamera(modelMouse, modelCamera);
    const hits = modelRaycaster.intersectObjects(modelGroup.children, true);
    if (hits.length > 0) focusModelAtPoint(hits[0].point);
  });
  
  modelCanvas.addEventListener("pointercancel", () => {
    modelIsDragging = false;
  });
  
  modelCanvas.addEventListener("pointerleave", () => {
    modelIsDragging = false;
  });
  
  // ─── Animation loop ───────────────────────────────────────
  const clock = new THREE.Clock();
  let globeMarkerFrame = 0;
  
  function animate() {
    requestAnimationFrame(animate);
  
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
  
    const sunAngle = 0.35 + Math.sin(t * 0.015) * 0.06;
    spaceAccents.sunCore.position.set(Math.cos(sunAngle) * 18, 5.8, Math.sin(sunAngle) * 18);
    spaceAccents.sunSprite.position.copy(spaceAccents.sunCore.position);
    spaceAccents.sunCoronaSprite.position.copy(spaceAccents.sunCore.position);
    sun.position.copy(spaceAccents.sunCore.position).normalize().multiplyScalar(8);
    spaceAccents.moon.position.set(Math.cos(t * 0.035) * 3.4, 1.4 + Math.sin(t * 0.05) * 0.28, Math.sin(t * 0.035) * 3.4);
    spaceAccents.moon.rotation.y += dt * 0.08;
    spaceAccents.moonHalo.position.copy(spaceAccents.moon.position);
  
    if (viewMode === "globe" && !earthUserInteracting && !earthCameraTween && !overlay.classList.contains("visible")) {
      const spin = dt * 0.018;
      earth.rotation.y += spin;
      if (markerContainer) markerContainer.rotation.y = earth.rotation.y;
    }
  
    updateMapTween();
  
    globeMarkerFrame += 1;
    if (!isLowPowerDevice() || globeMarkerFrame % 2 === 0) updateGlobeMarkerPresentation(t);
  
    updateEarthCameraTween();
    if (!earthCameraTween) controls.update();
    maybeEnterMapDetailFromGlobe();
    renderer.render(scene, camera);
  
    if (overlay.classList.contains("visible")) {
      updateModelRendererSize();
      updateModelCameraTween();
      modelControls.update();
      if (modelRotationEnabled && !modelIsDragging && !photoDetailVisible) {
        modelGroup.rotation.y += dt * Number(modelRotateSpeed.value);
      }
      modelRenderer.render(modelScene, modelCamera);
    }
  }
  
  animate();
  
  // ─── Touch hint adaptation ─────────────────────────────────
  const hintEl = document.getElementById("hint");
  if (isTouchDevice) {
    hintEl.innerHTML = "单指浏览 &nbsp;|&nbsp; 双指缩放 &nbsp;|&nbsp; 点击光点查看详情";
  }
  
  // ─── Resize handler ───────────────────────────────────────
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(getScenePixelRatio());
    modelRenderer.setPixelRatio(getModelPixelRatio());
    if (mapDetailVisible) renderDetailMapNow();
  });
  
}
