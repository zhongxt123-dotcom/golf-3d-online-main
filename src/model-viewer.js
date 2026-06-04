// 3D 模型模块：维护球场 GLB 缓存、模板 clone 和轻量 fallback 地形。
import * as THREE from "three";

export function normalizeLoadedCourseScene(sceneObject) {
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

export function cloneLoadedCourseScene(sceneTemplate) {
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

export function addFallbackCourseModel(modelGroup) {
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

export function createCourseModelCache() {
  const cache = new Map();
  let gltfLoaderModulePromise = null;

  function createModelLoadPromise(modelUrl) {
    gltfLoaderModulePromise ||= import("three/addons/loaders/GLTFLoader.js");
    const entry = {
      state: "loading",
      promise: null,
      scene: null,
      error: null,
      progress: 0,
      progressListeners: new Set(),
    };
    const notifyProgress = (pct) => {
      entry.progress = pct;
      entry.progressListeners.forEach((listener) => listener(pct));
    };
    entry.promise = gltfLoaderModulePromise
      .then(({ GLTFLoader }) => new Promise((resolve, reject) => {
        const modelLoader = new GLTFLoader();
        modelLoader.load(
          modelUrl,
          (gltf) => {
            entry.scene = normalizeLoadedCourseScene(gltf.scene);
            entry.state = "loaded";
            notifyProgress(100);
            resolve(entry.scene);
          },
          (xhr) => {
            if (xhr.total > 0) notifyProgress(Math.min(99, Math.round((xhr.loaded / xhr.total) * 100)));
          },
          (error) => {
            entry.state = "failed";
            entry.error = error;
            reject(error);
          }
        );
      }))
      .catch((error) => {
        entry.state = "failed";
        entry.error = error;
        throw error;
      });
    cache.set(modelUrl, entry);
    return entry;
  }

  function load(modelUrl, onProgress) {
    let entry = cache.get(modelUrl);
    if (!entry) entry = createModelLoadPromise(modelUrl);

    if (entry.state === "loaded" && entry.scene) {
      onProgress?.(100);
      return Promise.resolve(entry.scene);
    }

    if (entry.state === "failed") {
      return Promise.reject(entry.error || new Error(`Model failed: ${modelUrl}`));
    }

    if (typeof onProgress === "function") {
      entry.progressListeners.add(onProgress);
      onProgress(entry.progress || 0);
    }

    return entry.promise.finally(() => {
      if (typeof onProgress === "function") entry.progressListeners.delete(onProgress);
    });
  }

  return { cache, load };
}

export function initModelViewerModule() {
  return {
    responsibility: "3D 模型、模型缓存、fallback 地形、实景视频和 3D 近景快照",
    createCourseModelCache,
  };
}
