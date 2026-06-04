import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const errors = [];
const warnings = [];
const notes = [];

function rel(path) {
  return path.replaceAll("\\", "/");
}

function filePath(path) {
  return join(root, path);
}

function pass(message) {
  notes.push(`通过：${message}`);
}

function fail(message) {
  errors.push(`错误：${message}`);
}

function warn(message) {
  warnings.push(`警告：${message}`);
}

function checkFile(path, required = true) {
  const fullPath = filePath(path);
  if (!existsSync(fullPath)) {
    if (required) fail(`缺少文件 ${rel(path)}`);
    else warn(`未找到可选文件 ${rel(path)}`);
    return null;
  }
  const stat = statSync(fullPath);
  if (!stat.isFile()) {
    fail(`${rel(path)} 存在，但不是文件`);
    return null;
  }
  pass(`${rel(path)} 存在`);
  return stat;
}

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${bytes} B`;
}

function readText(path) {
  return readFileSync(filePath(path), "utf8");
}

function collectFiles(dir, extension, output = []) {
  const fullDir = filePath(dir);
  if (!existsSync(fullDir)) return output;
  readdirSync(fullDir, { withFileTypes: true }).forEach((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectFiles(child, extension, output);
      return;
    }
    if (entry.isFile() && entry.name.endsWith(extension)) {
      output.push(child);
    }
  });
  return output;
}

async function checkLocations() {
  try {
    const moduleUrl = pathToFileURL(filePath("locations.js")).href;
    const { golfLocations } = await import(`${moduleUrl}?check=${Date.now()}`);

    if (!Array.isArray(golfLocations)) {
      fail("locations.js 没有导出数组 golfLocations");
      return;
    }

    if (golfLocations.length <= 0) {
      fail("golfLocations 数量必须大于 0");
      return;
    }

    pass(`golfLocations 数量为 ${golfLocations.length}`);

    golfLocations.forEach((course, index) => {
      const label = course?.name || `第 ${index + 1} 个球场`;
      const requiredFields = ["name", "lat", "lng", "description", "tags"];

      requiredFields.forEach((field) => {
        if (course?.[field] === undefined || course?.[field] === null || course?.[field] === "") {
          fail(`${label} 缺少必填字段 ${field}`);
        }
      });

      if (typeof course?.tags !== "object" || Array.isArray(course.tags)) {
        fail(`${label} 的 tags 必须是对象`);
      }

      const lat = Number(course?.lat);
      const lng = Number(course?.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        fail(`${label} 的 lat 不在合理范围：${course?.lat}`);
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        fail(`${label} 的 lng 不在合理范围：${course?.lng}`);
      }
    });

    pass("球场字段和经纬度范围检查完成");
  } catch (error) {
    fail(`无法加载 locations.js：${error.message}`);
  }
}

function checkAbsoluteAssetPaths() {
  const files = ["index.html", "main.js", "locations.js", "style.css", ...collectFiles("src", ".js")];
  const pattern = /(^|["'`(\s])\/assets\//g;
  files.forEach((file) => {
    const content = readText(file);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        fail(`${file}:${index + 1} 存在以 /assets/ 开头的绝对资源路径，GitHub Pages 子路径下可能 404`);
      }
    });
  });
  pass("资源路径绝对路径扫描完成");
}

function checkRealviewPolicy() {
  const content = readText("locations.js");
  const forbiddenPatterns = [
    /index\s*%\s*2[\s\S]{0,220}course_realview_/,
    /course_realview_[12]\.mp4[\s\S]{0,220}index\s*%\s*2/,
  ];

  forbiddenPatterns.forEach((pattern) => {
    if (pattern.test(content)) {
      fail("locations.js 存在按 index 奇偶自动分配实景视频的逻辑，请只给明确配置的球场设置 realviewVideo/panoVideo");
    }
  });

  pass("本地实景视频策略检查完成");
}

function checkGitTrackedIgnores() {
  let output = "";
  try {
    output = execFileSync("git", ["ls-files", ".claude", "node_modules"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    warn(`无法执行 git ls-files：${error.message}`);
    return;
  }

  if (!output) {
    pass(".claude 与 node_modules 未被 Git 跟踪");
    return;
  }

  output.split(/\r?\n/).filter(Boolean).forEach((path) => {
    fail(`${rel(path)} 已被 Git 跟踪，请在发布前执行 git rm --cached ${rel(path)} 后再提交`);
  });
}

async function main() {
  console.log("3D Golf 发布前检查");
  console.log("==================");

  checkFile("index.html");
  checkFile("main.js");
  checkFile("style.css");
  checkFile("locations.js");
  checkFile("package.json");
  checkFile("assets/caddy_photo.png");

  const modelStat = checkFile("assets/golf_scene.glb");
  if (modelStat) {
    pass(`assets/golf_scene.glb 大小：${formatBytes(modelStat.size)}`);
  }

  await checkLocations();
  checkAbsoluteAssetPaths();
  checkRealviewPolicy();
  checkGitTrackedIgnores();

  console.log("");
  notes.forEach((message) => console.log(`✓ ${message}`));

  if (warnings.length) {
    console.log("");
    warnings.forEach((message) => console.log(`! ${message}`));
  }

  if (errors.length) {
    console.log("");
    errors.forEach((message) => console.log(`✗ ${message}`));
    console.log("");
    console.log(`检查失败：${errors.length} 个错误，${warnings.length} 个警告。`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`检查通过：0 个错误，${warnings.length} 个警告。可以发布。`);
}

await main();
