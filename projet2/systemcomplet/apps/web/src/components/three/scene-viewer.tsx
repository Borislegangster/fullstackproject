"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface MaterialSpec {
  color_hex?: string | null;
  roughness?: number | string | null;
  metalness?: number | string | null;
  texture_url?: string | null;
  normal_url?: string | null;
  repeat?: number | string | null;
}

export interface SceneViewerHandle {
  applyMaterial: (meshNames: string[], spec: MaterialSpec) => void;
  snapshot: () => Promise<Blob | null>;
  resetView: () => void;
  meshNames: () => string[];
  highlight: (names: string[] | null) => void;
  setVisible: (predicate: (name: string) => boolean) => void;
}

interface Props {
  url: string;
  className?: string;
  background?: string;
  onLoaded?: (meshNames: string[]) => void;
  onPick?: (meshName: string, point: { x: number; y: number; z: number }) => void;
  onError?: (message: string) => void;
}

/** Visionneuse 3D (glTF/GLB) : rotation/zoom tactiles, matériaux PBR, capture d'image, sélection d'objets. */
export const SceneViewer = forwardRef<SceneViewerHandle, Props>(function SceneViewer({ url, className, background = "#eef2fa", onLoaded, onPick, onError }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    root?: THREE.Object3D;
    home?: { position: THREE.Vector3; target: THREE.Vector3 };
    textures: Map<string, THREE.Texture>;
    originals: Map<string, THREE.Material | THREE.Material[]>;
  }>({ textures: new Map(), originals: new Map() });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const callbacks = useRef({ onLoaded, onPick, onError });
  callbacks.current = { onLoaded, onPick, onError };

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const s = state.current;
    let disposed = false;
    let frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.6);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.05, 5000);
    camera.position.set(8, 6, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    Object.assign(s, { renderer, scene, camera, controls });

    const loader = new GLTFLoader();
    loader.setWithCredentials(true);
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            s.originals.set(mesh.uuid, mesh.material);
          }
        });
        scene.add(root);
        s.root = root;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3()).length() || 10;
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.45, size * 0.75));
        camera.near = size / 200;
        camera.far = size * 20;
        camera.updateProjectionMatrix();
        controls.update();
        s.home = { position: camera.position.clone(), target: controls.target.clone() };
        setStatus("ready");
        const names: string[] = [];
        root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
        });
        callbacks.current.onLoaded?.(names);
      },
      (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
      },
      (err) => {
        if (disposed) return;
        setStatus("error");
        callbacks.current.onError?.(err instanceof Error ? err.message : "Modèle 3D illisible");
      },
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!callbacks.current.onPick || !s.root) return;
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(s.root, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
      if (hit) callbacks.current.onPick(hit.object.name, { x: hit.point.x, y: hit.point.y, z: hit.point.z });
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(container);

    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      s.textures.forEach((t) => t.dispose());
      s.textures.clear();
      s.originals.clear();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      pmrem.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [url, background]);

  useImperativeHandle(ref, () => ({
    applyMaterial(meshNames, spec) {
      const s = state.current;
      if (!s.root) return;
      const wanted = new Set(meshNames);
      const texture = (src?: string | null, color = true) => {
        if (!src) return null;
        let t = s.textures.get(src);
        if (!t) {
          const tl = new THREE.TextureLoader();
          tl.setCrossOrigin("use-credentials");
          t = tl.load(src);
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          if (color) t.colorSpace = THREE.SRGBColorSpace;
          s.textures.set(src, t);
        }
        const repeat = Number(spec.repeat ?? 1) || 1;
        t.repeat.set(repeat, repeat);
        return t;
      };
      s.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const match = wanted.has(mesh.name) || [...wanted].some((n) => n && (mesh.name.startsWith(`${n}_`) || mesh.parent?.name === n));
        if (!match) return;
        const material = new THREE.MeshStandardMaterial({
          color: spec.color_hex ? new THREE.Color(spec.color_hex) : new THREE.Color(0xffffff),
          roughness: spec.roughness !== null && spec.roughness !== undefined ? Number(spec.roughness) : 0.7,
          metalness: spec.metalness !== null && spec.metalness !== undefined ? Number(spec.metalness) : 0,
          map: texture(spec.texture_url) ?? null,
          normalMap: texture(spec.normal_url, false) ?? null,
        });
        mesh.material = material;
      });
    },
    async snapshot() {
      const s = state.current;
      if (!s.renderer || !s.scene || !s.camera) return null;
      s.renderer.render(s.scene, s.camera);
      return new Promise<Blob | null>((resolve) => s.renderer!.domElement.toBlob((b) => resolve(b), "image/png"));
    },
    resetView() {
      const s = state.current;
      if (!s.home || !s.camera || !s.controls) return;
      s.camera.position.copy(s.home.position);
      s.controls.target.copy(s.home.target);
      s.controls.update();
    },
    meshNames() {
      const names: string[] = [];
      state.current.root?.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.name) names.push(o.name);
      });
      return names;
    },
    highlight(names) {
      const s = state.current;
      s.root?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
        mats.forEach((m) => {
          if (m && "emissive" in m) m.emissive = new THREE.Color(names && names.includes(mesh.name) ? 0xfb8c43 : 0x000000);
        });
      });
    },
    setVisible(predicate) {
      state.current.root?.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.visible = predicate(o.name);
      });
    },
  }));

  return (
    <div className={className ?? "h-[420px]"} style={{ position: "relative" }}>
      <div ref={host} className="absolute inset-0 overflow-hidden rounded-2xl" />
      {status !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-sm text-muted">
          {status === "loading" ? `Chargement du modèle 3D… ${progress ? `${progress} %` : ""}` : "Le modèle 3D n'a pas pu être chargé."}
        </div>
      ) : null}
    </div>
  );
});
