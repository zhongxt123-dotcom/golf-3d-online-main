// 应用入口：只负责装配 src 下的 ES Module 并启动 3D 高尔夫地图。
import { initProfileModule } from "./src/profile.js?v=mobile-marker-bag-20260522";
import { initCaddyModule } from "./src/caddy.js?v=mobile-marker-bag-20260522";
import { initCourseListModule } from "./src/course-list.js?v=mobile-marker-bag-20260522";
import { initGlobeModule } from "./src/globe.js?v=mobile-marker-bag-20260522";
import { initDetailMapModule } from "./src/detail-map.js?v=mobile-marker-bag-20260522";
import { initModelViewerModule } from "./src/model-viewer.js?v=mobile-marker-bag-20260522";
import { initUtilsModule } from "./src/utils.js?v=mobile-marker-bag-20260522";
import { initGolfApp } from "./src/app.js?v=course-info-suffix-20260604";

const moduleRegistry = {
  profile: initProfileModule(),
  caddy: initCaddyModule(),
  courseList: initCourseListModule(),
  globe: initGlobeModule(),
  detailMap: initDetailMapModule(),
  modelViewer: initModelViewerModule(),
  utils: initUtilsModule(),
};

initGolfApp(moduleRegistry);
