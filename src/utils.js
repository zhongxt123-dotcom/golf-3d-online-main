// 通用工具模块：集中维护 HTML 转义、距离计算、坐标转换和格式化函数。
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function formatList(value, fallback = "待确认") {
  if (Array.isArray(value) && value.length) return value.filter(Boolean).join("、");
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function formatFacilityValue(value) {
  if (value === true) return "有";
  if (value === false) return "待确认";
  if (typeof value === "string" && value.trim()) return value.trim();
  return "待确认";
}

export function distanceKm(a, b) {
  const toRad = (deg) => deg * Math.PI / 180;
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

export function formatDistance(km) {
  if (km === null || km === undefined) return "";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
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

export function isOutsideChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

export function wgs84ToGcj02(lat, lng) {
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

export function gcj02ToWgs84(lat, lng) {
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

export function lngLatToWorld(lng, lat, zoom, tileSize = 256) {
  const sinLat = Math.sin(clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180);
  const worldSize = tileSize * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

export function initUtilsModule() {
  return {
    clamp,
    lerp,
    escapeHtml,
    formatList,
    formatFacilityValue,
    distanceKm,
    formatDistance,
    wgs84ToGcj02,
    gcj02ToWgs84,
    lngLatToWorld,
  };
}
