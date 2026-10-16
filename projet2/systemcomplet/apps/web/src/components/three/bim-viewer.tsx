"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";

export interface BimSource {
  key: string;
  name: string;
  url: string;
  format: string;
  color?: string | null;
  visible: boolean;
}

export interface BimMarker {
  id: string;
  position: { x: number; y: number; z: number };
  color?: string;
  label?: string;
}

export interface BimPick {
  modelKey: string | null;
  objectName: string;
  expressId?: number;
  point: { x: number; y: number; z: number };
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface BimElement {
  db_id: number | null;
  name: string;
  /** Boîte englobante monde : [minX, minY, minZ, maxX, maxY, maxZ]. */
  bbox: [number, number, number, number, number, number];
}

export interface BimViewerHandle {
  getCamera: () => CameraState | null;
  setCamera: (camera: CameraState) => void;
  fitAll: () => void;
  snapshot: () => Promise<Blob | null>;
  setSection: (axis: "x" | "y" | "z" | null, ratio?: number) => void;
  /** Éléments d'une maquette chargée avec leurs boîtes englobantes (détection de conflits assistée). */
  elements: (modelKey: string) => BimElement[];
}

interface LoadedModel {
  key: string;
  root: THREE.Object3D;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  return res.arrayBuffer();
}

let ifcApiPromise: Promise<any> | null = null;
async function ifcApi(): Promise<any> {
  if (!ifcApiPromise) {
    ifcApiPromise = (async () => {
      const WebIFC = await import("web-ifc");
      const api = new WebIFC.IfcAPI();
      api.SetWasmPath("/wasm/", true);
      await api.Init(undefined, true);
      return api;
    })();
  }
  return ifcApiPromise;
}

/** Conversion IFC → objets three.js (web-ifc, WASM), sans dépendance à un service tiers. */
async function loadIfc(url: string): Promise<THREE.Object3D> {
  const [api, buffer] = await Promise.all([ifcApi(), fetchBuffer(url)]);
  const modelId = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });
  const group = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  api.StreamAllMeshes(modelId, (mesh: any) => {
    const placed = mesh.geometries;
    for (let i = 0; i < placed.size(); i++) {
      const pg = placed.get(i);
      const geometry = api.GetGeometry(modelId, pg.geometryExpressID);
      const verts: Float32Array = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const index: Uint32Array = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
      const positions = new Float32Array(verts.length / 2);
      const normals = new Float32Array(verts.length / 2);
      for (let v = 0, p = 0; v < verts.length; v += 6, p += 3) {
        positions[p] = verts[v];
        positions[p + 1] = verts[v + 1];
        positions[p + 2] = verts[v + 2];
        normals[p] = verts[v + 3];
        normals[p + 1] = verts[v + 4];
        normals[p + 2] = verts[v + 5];
      }
      const buffer = new THREE.BufferGeometry();
      buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      buffer.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      buffer.setIndex(new THREE.BufferAttribute(index, 1));
      const c = pg.color;
      const key = `${c.x.toFixed(3)}-${c.y.toFixed(3)}-${c.z.toFixed(3)}-${c.w.toFixed(2)}`;
      let material = materials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.x, c.y, c.z), transparent: c.w < 1, opacity: c.w, side: THREE.DoubleSide, roughness: 0.8 });
        materials.set(key, material);
      }
      const object = new THREE.Mesh(buffer, material);
      object.matrixAutoUpdate = false;
      object.matrix.fromArray(pg.flatTransformation);
      object.name = `ifc:${mesh.expressID}`;
      object.userData.expressId = mesh.expressID;
      group.add(object);
      geometry.delete();
    }
  });
  api.CloseModel(modelId);
  return group;
}

async function loadSource(src: BimSource): Promise<THREE.Object3D> {
  const fmt = src.format.toLowerCase();
  if (fmt === "ifc") return loadIfc(src.url);
  if (fmt === "glb" || fmt === "gltf") {
    const loader = new GLTFLoader();
    loader.setWithCredentials(true);
    return (await loader.loadAsync(src.url)).scene;
  }
  if (fmt === "obj") {
    const loader = new OBJLoader();
    loader.setWithCredentials(true);
    return loader.loadAsync(src.url);
  }
  if (fmt === "fbx") {
    const loader = new FBXLoader();
    loader.setWithCredentials(true);
    return loader.loadAsync(src.url);
  }
  if (fmt === "3ds") {
    const loader = new TDSLoader();
    loader.setWithCredentials(true);
    return loader.loadAsync(src.url);
  }
  if (fmt === "stl") {
    const loader = new STLLoader();
    loader.setWithCredentials(true);
    const geometry = await loader.loadAsync(src.url);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: src.color ?? "#9aa8c7", roughness: 0.7 }));
  }
  throw new Error(`Format ${fmt} non affichable dans le navigateur`);
}

/** Visionneuse BIM fédérée (three.js) : plusieurs disciplines, calques, sélection, repères d'annotations, coupe. */
export const BimViewer = forwardRef<
  BimViewerHandle,
  {
    sources: BimSource[];
    markers?: BimMarker[];
    cursors?: { id: string; name: string; position: { x: number; y: number; z: number }; color: string }[];
    onPick?: (pick: BimPick) => void;
    onMarkerClick?: (id: string) => void;
    onCameraChange?: (camera: CameraState) => void;
    className?: string;
    dark?: boolean;
  }
>(function BimViewer({ sources, markers = [], cursors = [], onPick, onMarkerClick, onCameraChange, className, dark }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    models: Map<string, LoadedModel>;
    markerGroup: THREE.Group;
    cursorGroup: THREE.Group;
    clip: THREE.Plane[];
  }>({ models: new Map(), markerGroup: new THREE.Group(), cursorGroup: new THREE.Group(), clip: [] });
  const [status, setStatus] = useState<Record<string, "loading" | "ready" | "error">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cb = useRef({ onPick, onMarkerClick, onCameraChange });
  cb.current = { onPick, onMarkerClick, onCameraChange };

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const c = ctx.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? "#141f3b" : "#eef2fa");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(30, 60, 20);
    scene.add(sun);
    const grid = new THREE.GridHelper(200, 100, dark ? 0x2f4c8d : 0xb3c3e6, dark ? 0x1d2e57 : 0xd8e1f3);
    grid.name = "__grid";
    scene.add(grid);
    scene.add(c.markerGroup, c.cursorGroup);
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / Math.max(1, container.clientHeight), 0.05, 20000);
    camera.position.set(25, 18, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    controls.addEventListener("change", () => {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        cb.current.onCameraChange?.({ position: camera.position.toArray() as [number, number, number], target: controls.target.toArray() as [number, number, number] });
      }, 250);
    });
    Object.assign(c, { renderer, scene, camera, controls });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const markerHit = raycaster.intersectObjects(c.markerGroup.children, false)[0];
      if (markerHit) {
        cb.current.onMarkerClick?.(String(markerHit.object.userData.markerId));
        return;
      }
      const roots = [...c.models.values()].filter((m) => m.root.visible).map((m) => m.root);
      const hit = raycaster.intersectObjects(roots, true).find((h) => (h.object as THREE.Mesh).isMesh && c.clip.every((plane) => plane.distanceToPoint(h.point) >= 0));
      if (!hit) return;
      let modelKey: string | null = null;
      for (const [key, m] of c.models) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          if (o === m.root) modelKey = key;
          o = o.parent;
        }
      }
      cb.current.onPick?.({ modelKey, objectName: hit.object.name, expressId: hit.object.userData.expressId, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z } });
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    const ro = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
    });
    ro.observe(container);
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m?.dispose());
        }
      });
      pmrem.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      c.models.clear();
    };
  }, [dark]);

  const fit = () => {
    const c = ctx.current;
    if (!c.camera || !c.controls) return;
    const box = new THREE.Box3();
    c.models.forEach((m) => m.root.visible && box.expandByObject(m.root));
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length() || 10;
    const center = box.getCenter(new THREE.Vector3());
    c.controls.target.copy(center);
    c.camera.position.copy(center).add(new THREE.Vector3(size * 0.55, size * 0.4, size * 0.7));
    c.camera.near = Math.max(0.01, size / 500);
    c.camera.far = size * 50;
    c.camera.updateProjectionMatrix();
    c.controls.update();
    const grid = c.scene?.getObjectByName("__grid");
    if (grid) grid.position.y = box.min.y;
  };

  // Chargement / déchargement des maquettes selon les sources.
  useEffect(() => {
    const c = ctx.current;
    if (!c.scene) return;
    const wanted = new Set(sources.map((s) => s.key));
    for (const [key, m] of c.models) {
      if (!wanted.has(key)) {
        c.scene.remove(m.root);
        c.models.delete(key);
      }
    }
    let cancelled = false;
    sources.forEach((src) => {
      const existing = c.models.get(src.key);
      if (existing) {
        existing.root.visible = src.visible;
        return;
      }
      if (status[src.key] === "loading" || status[src.key] === "error") return;
      setStatus((s) => ({ ...s, [src.key]: "loading" }));
      loadSource(src)
        .then((root) => {
          if (cancelled || !c.scene) return;
          root.visible = src.visible;
          root.userData.modelKey = src.key;
          if (c.clip.length) {
            root.traverse((o) => {
              const mesh = o as THREE.Mesh;
              if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => (mat.clippingPlanes = c.clip));
            });
          }
          c.scene.add(root);
          c.models.set(src.key, { key: src.key, root });
          setStatus((s) => ({ ...s, [src.key]: "ready" }));
          if (c.models.size === 1) fit();
        })
        .catch((err: Error) => {
          setStatus((s) => ({ ...s, [src.key]: "error" }));
          setErrors((e) => ({ ...e, [src.key]: err.message }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  // Repères d'annotations et curseurs des autres participants.
  useEffect(() => {
    const group = ctx.current.markerGroup;
    group.clear();
    markers.forEach((m) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshBasicMaterial({ color: m.color ?? "#FB8C43", depthTest: false }));
      sphere.position.set(m.position.x, m.position.y, m.position.z);
      sphere.renderOrder = 999;
      sphere.userData.markerId = m.id;
      group.add(sphere);
    });
  }, [markers]);

  useEffect(() => {
    const group = ctx.current.cursorGroup;
    group.clear();
    cursors.forEach((cur) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 12), new THREE.MeshBasicMaterial({ color: cur.color, depthTest: false }));
      cone.position.set(cur.position.x, cur.position.y + 0.3, cur.position.z);
      cone.rotation.x = Math.PI;
      cone.renderOrder = 998;
      group.add(cone);
    });
  }, [cursors]);

  useImperativeHandle(ref, () => ({
    getCamera() {
      const c = ctx.current;
      if (!c.camera || !c.controls) return null;
      return { position: c.camera.position.toArray() as [number, number, number], target: c.controls.target.toArray() as [number, number, number] };
    },
    setCamera(cam) {
      const c = ctx.current;
      if (!c.camera || !c.controls) return;
      c.camera.position.fromArray(cam.position);
      c.controls.target.fromArray(cam.target);
      c.controls.update();
    },
    fitAll: fit,
    async snapshot() {
      const c = ctx.current;
      if (!c.renderer || !c.scene || !c.camera) return null;
      c.renderer.render(c.scene, c.camera);
      return new Promise((resolve) => c.renderer!.domElement.toBlob((b) => resolve(b), "image/png"));
    },
    setSection(axis, ratio = 0.5) {
      const c = ctx.current;
      const planes: THREE.Plane[] = [];
      if (axis) {
        const box = new THREE.Box3();
        c.models.forEach((m) => box.expandByObject(m.root));
        if (!box.isEmpty()) {
          const normal = new THREE.Vector3(axis === "x" ? -1 : 0, axis === "y" ? -1 : 0, axis === "z" ? -1 : 0);
          const coord = box.min[axis] + (box.max[axis] - box.min[axis]) * ratio;
          planes.push(new THREE.Plane(normal, coord));
        }
      }
      c.clip = planes;
      c.models.forEach((m) =>
        m.root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => (mat.clippingPlanes = planes));
        }),
      );
    },
    elements(modelKey) {
      const model = ctx.current.models.get(modelKey);
      if (!model) return [];
      model.root.updateMatrixWorld(true);
      const boxes = new Map<string, { id: number | null; name: string; box: THREE.Box3 }>();
      model.root.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const id = typeof mesh.userData.expressId === "number" ? (mesh.userData.expressId as number) : null;
        const key = id !== null ? `ifc:${id}` : mesh.uuid;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
        const entry = boxes.get(key);
        if (entry) entry.box.union(box);
        else boxes.set(key, { id, name: mesh.name || key, box });
      });
      return [...boxes.values()]
        .filter((e) => !e.box.isEmpty())
        .map((e) => ({ db_id: e.id, name: e.name, bbox: [e.box.min.x, e.box.min.y, e.box.min.z, e.box.max.x, e.box.max.y, e.box.max.z] as BimElement["bbox"] }));
    },
  }));

  const loading = Object.values(status).filter((s) => s === "loading").length;
  const failed = Object.entries(errors);
  return (
    <div className={className ?? "h-[520px]"} style={{ position: "relative" }}>
      <div ref={host} className="absolute inset-0 overflow-hidden rounded-xl" />
      {loading ? <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-ink shadow">Chargement de {loading} maquette(s)…</div> : null}
      {failed.length ? (
        <div className="absolute bottom-3 left-3 right-3 space-y-1">
          {failed.map(([key, msg]) => (
            <p key={key} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow">
              {sources.find((s) => s.key === key)?.name ?? key} : {msg}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
});
