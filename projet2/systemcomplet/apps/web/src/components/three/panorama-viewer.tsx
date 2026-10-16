"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Visionneuse 360° (photo ou vidéo équirectangulaire) : glisser pour regarder autour, molette/pincement pour zoomer. */
export function PanoramaViewer({ url, video = false, className }: { url: string; video?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / Math.max(1, container.clientHeight), 1, 1100);
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    let videoEl: HTMLVideoElement | null = null;
    let texture: THREE.Texture;
    if (video) {
      videoEl = document.createElement("video");
      videoEl.src = url;
      videoEl.crossOrigin = "use-credentials";
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      void videoEl.play().catch(() => undefined);
      texture = new THREE.VideoTexture(videoEl);
    } else {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("use-credentials");
      texture = loader.load(url);
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    scene.add(mesh);
    let lon = 0;
    let lat = 0;
    let dragging = false;
    let start = { x: 0, y: 0, lon: 0, lat: 0 };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      start = { x: e.clientX, y: e.clientY, lon, lat };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
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
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
    });
    ro.observe(container);
    let frame = 0;
    const target = new THREE.Vector3();
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!dragging) lon += 0.03;
      lat = Math.max(-85, Math.min(85, lat));
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      target.set(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      videoEl?.pause();
      texture.dispose();
      geometry.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [url, video]);
  return <div ref={host} className={className ?? "h-[420px] overflow-hidden rounded-xl bg-black"} />;
}
