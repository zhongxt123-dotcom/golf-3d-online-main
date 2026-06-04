import { golfLocations } from "../locations.js";

// Re-run province/city matching using the actual file (which now has our fixes)
// Check the previously problematic courses
const testNames = [
  "上海美兰湖",
  "重庆保利",
  "南昌保利",
  "厦门东方",
  "武夷山太伟",
  "重庆庆隆南山",
  "遵义保利",
  "海口美兰高尔夫俱乐部",
  "北京太伟高尔夫俱乐部",
  "宁波东方",
  "烟台南山丹岭",
  "山东南山国际",
  "秦皇岛保利",
];

console.log("=== Province matching tests (using actual locations data) ===");
testNames.forEach((name) => {
  const found = golfLocations.find((loc) => loc.name === name);
  if (found) {
    console.log(
      `${name} -> ${found.province || "N/A"} / ${found.city || "N/A"}  coords: ${found.lat}, ${found.lng}`
    );
  } else {
    console.log(`${name} -> NOT FOUND in locations`);
  }
});

// Now check all courses for coordinate-province mismatches
const provinceBounds = {
  "海南": { minLat: 18, maxLat: 20.5, minLng: 108.5, maxLng: 111 },
  "广东": { minLat: 20, maxLat: 25.5, minLng: 109.5, maxLng: 117.5 },
  "北京": { minLat: 39.3, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 },
  "上海": { minLat: 30.6, maxLat: 31.9, minLng: 120.8, maxLng: 122 },
  "云南": { minLat: 21, maxLat: 29.5, minLng: 97.5, maxLng: 106.5 },
  "浙江": { minLat: 27, maxLat: 31.5, minLng: 118, maxLng: 123 },
  "江苏": { minLat: 30.5, maxLat: 35.5, minLng: 116, maxLng: 122 },
  "山东": { minLat: 34.3, maxLat: 38.5, minLng: 114.5, maxLng: 122.7 },
  "福建": { minLat: 23.5, maxLat: 28.5, minLng: 115.5, maxLng: 120.5 },
  "四川": { minLat: 26, maxLat: 34.5, minLng: 97.5, maxLng: 108.5 },
  "重庆": { minLat: 28.1, maxLat: 32.2, minLng: 105.3, maxLng: 110.3 },
  "湖北": { minLat: 29, maxLat: 33.3, minLng: 108, maxLng: 116.2 },
  "湖南": { minLat: 24.5, maxLat: 30.2, minLng: 108.5, maxLng: 114.3 },
  "广西": { minLat: 21, maxLat: 26.5, minLng: 104.5, maxLng: 112 },
  "辽宁": { minLat: 38.5, maxLat: 43.5, minLng: 118.5, maxLng: 125.8 },
  "天津": { minLat: 38.5, maxLat: 40.3, minLng: 116.5, maxLng: 118 },
  "河北": { minLat: 36, maxLat: 42.6, minLng: 113.5, maxLng: 119.9 },
  "贵州": { minLat: 24.5, maxLat: 29.3, minLng: 103.5, maxLng: 109.5 },
  "江西": { minLat: 24.5, maxLat: 30.2, minLng: 113.5, maxLng: 118.5 },
  "河南": { minLat: 31.5, maxLat: 36.5, minLng: 110, maxLng: 116.8 },
  "安徽": { minLat: 29.5, maxLat: 34.5, minLng: 114.5, maxLng: 119.5 },
  "陕西": { minLat: 31.5, maxLat: 39.5, minLng: 105.5, maxLng: 111.3 },
  "山西": { minLat: 34.5, maxLat: 41, minLng: 110, maxLng: 114.5 },
  "宁夏": { minLat: 35, maxLat: 39.5, minLng: 104, maxLng: 107.7 },
  "新疆": { minLat: 34, maxLat: 49, minLng: 73.5, maxLng: 96.5 },
  "吉林": { minLat: 41, maxLat: 46.3, minLng: 121.5, maxLng: 131.5 },
  "黑龙江": { minLat: 43.5, maxLat: 53.5, minLng: 121, maxLng: 135.2 },
  "内蒙古": { minLat: 37.5, maxLat: 53.3, minLng: 97, maxLng: 126 },
  "澳门": { minLat: 22.1, maxLat: 22.22, minLng: 113.52, maxLng: 113.6 },
  "西藏": { minLat: 26.5, maxLat: 36.5, minLng: 78.5, maxLng: 99.3 },
  "甘肃": { minLat: 32.5, maxLat: 42.8, minLng: 92.5, maxLng: 108.8 },
};

console.log("");
console.log("=== Remaining coordinate-province mismatches ===");
let issues = 0;
golfLocations.forEach((loc, i) => {
  const p = loc.province || "unknown";
  const c = loc.city || "unknown";
  const bounds = provinceBounds[p];
  if (!bounds) return;
  if (loc.lat < bounds.minLat || loc.lat > bounds.maxLat || loc.lng < bounds.minLng || loc.lng > bounds.maxLng) {
    issues++;
    console.log(
      `BAD #${i}: ${loc.name} -> ${p}/${c} coords: ${loc.lat}, ${loc.lng} (expected lat ${bounds.minLat}-${bounds.maxLat}, lng ${bounds.minLng}-${bounds.maxLng})`
    );
  }
});
console.log(`Total remaining coordinate-province issues: ${issues}`);
