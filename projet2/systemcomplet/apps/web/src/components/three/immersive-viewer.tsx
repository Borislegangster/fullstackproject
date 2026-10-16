"use client";

import { Compass, Glasses, Maximize2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

/**
 * Visite immersive 360° (photo ou vidéo équirectangulaire) pour invités (R5) : glisser pour regarder, molette /
 * pincement pour zoomer, gyroscope du téléphone (« regarder autour de soi »), casque VR via WebXR, plein écran.
 */
export function ImmersiveViewer({ url, video = false, className }: { url: string; video?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const vrSlot = useRef<HTMLDivElement>(null);
  const gyro = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setGyroAvailable(typeof window !== "undefined" && "DeviceOrientationEvent" in window && "ontouchstart" in window);
    const container = host.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.xr.enabled = true;
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1100);
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    let texture: THREE.Texture;
    if (video) {
      const el = document.createElement("video");
      el.src = url;
      el.loop = true;
      el.muted = true;
      el.playsInline = true;
      el.crossOrigin = "anonymous";
      void el.play().catch(() => setPlaying(false));
      videoRef.current = el;
      texture = new THREE.VideoTexture(el);
    } else {
      texture = new THREE.TextureLoader().load(url);
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture })));

    // bouton VR (WebXR) seulement si un casque / navigateur compatible est présent
    let vrButton: HTMLElement | null = null;
    const nav = navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } };
    void nav.xr
      ?.isSessionSupported("immersive-vr")
      .then((ok) => {
        if (ok && vrSlot.current) {
          vrButton = VRButton.createButton(renderer);
          vrButton.style.position = "static";
          vrSlot.current.appendChild(vrButton);
        }
      })
      .catch(() => undefined);

    let lon = 0;
    let lat = 0;
    let dragging = false;
    let start = { x: 0, y: 0, lon: 0, lat: 0 };
    let orientation = { alpha: 0, beta: 90, gamma: 0 };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      start = { x: e.clientX, y: e.clientY, lon, lat };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || gyro.current) return;
      lon = (start.x - e.clientX) * 0.15 + start.lon;
      lat = (e.clientY - start.y) * 0.15 + start.lat;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, 30, 95);
      camera.updateProjectionMatrix();
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      orientation = { alpha: e.alpha ?? 0, beta: e.beta ?? 90, gamma: e.gamma ?? 0 };
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("deviceorientation", onOrientation);
    const ro = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
    });
    ro.observe(container);
    const target = new THREE.Vector3();
    const euler = new THREE.Euler();
    const screenFix = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // caméra regardant derrière l'écran
    renderer.setAnimationLoop(() => {
      if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
        return;
      }
      if (gyro.current) {
        euler.set(
          THREE.MathUtils.degToRad(orientation.beta),
          THREE.MathUtils.degToRad(orientation.alpha),
          THREE.MathUtils.degToRad(-orientation.gamma),
          "YXZ",
        );
        camera.quaternion.setFromEuler(euler).multiply(screenFix);
      } else {
        if (!dragging) lon += 0.03;
        lat = Math.max(-85, Math.min(85, lat));
        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);
        target.set(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
        camera.lookAt(target);
      }
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("deviceorientation", onOrientation);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      videoRef.current?.pause();
      vrButton?.remove();
      texture.dispose();
      geometry.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [url, video]);

  const toggleGyro = async () => {
    const Orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (!gyro.current && typeof Orientation.requestPermission === "function") {
      const state = await Orientation.requestPermission().catch(() => "denied");
      if (state !== "granted") return;
    }
    gyro.current = !gyro.current;
    setGyroOn(gyro.current);
  };

  return (
    <div className={className ?? "relative h-[70vh] min-h-[420px] overflow-hidden rounded-3xl bg-black"}>
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4">
        {video ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/25"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) void el.play().then(() => setPlaying(true));
              else {
                el.pause();
                setPlaying(false);
              }
            }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Lecture"}
          </button>
        ) : null}
        {gyroAvailable ? (
          <button
            type="button"
            onClick={() => void toggleGyro()}
            className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white backdrop-blur ${gyroOn ? "bg-accent-500" : "bg-white/15 hover:bg-white/25"}`}
          >
            <Compass className="h-4 w-4" /> {gyroOn ? "Gyroscope actif" : "Regarder autour de moi"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void host.current?.parentElement?.requestFullscreen?.()}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/25"
        >
          <Maximize2 className="h-4 w-4" /> Plein écran
        </button>
        <span className="pointer-events-auto inline-flex items-center gap-1.5 text-sm text-white/80">
          <Glasses className="h-4 w-4" />
          <span ref={vrSlot} className="[&>button]:!rounded-full [&>button]:!border-0 [&>button]:!bg-white/15 [&>button]:!px-3 [&>button]:!py-1.5 [&>button]:!text-sm" />
        </span>
      </div>
    </div>
  );
}
