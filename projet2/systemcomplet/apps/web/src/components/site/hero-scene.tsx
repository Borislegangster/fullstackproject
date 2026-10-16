"use client";

import { useEffect, useRef } from "react";
import type * as T from "three";

/**
 * Scène 3D de la vitrine : un bâtiment « jumeau numérique » qui se conçoit (plan filaire), se calcule (ossature
 * lumineuse), se construit (niveaux qui montent) et se contrôle (plan de scan) — la signature GLOBUS en image.
 * Three.js chargé à la demande ; rendu suspendu hors écran et figé si l'utilisateur réduit les animations.
 */
export function HeroScene({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => undefined as void;

    void import("three").then((THREE) => {
      if (disposed || !host.current) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const width = el.clientWidth || 600;
      const height = el.clientHeight || 600;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0a1530, 18, 42);
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(14, 11, 17);
      camera.lookAt(0, 4.2, 0);

      const BLUE = new THREE.Color("#6d8ee0");
      const BRAND = new THREE.Color("#385aa6");
      const ORANGE = new THREE.Color("#fb8c43");
      const world = new THREE.Group();
      scene.add(world);

      // Sol « plan » : grille technique et cercles de cotation
      const grid = new THREE.GridHelper(30, 30, BRAND, BRAND);
      (grid.material as T.Material).transparent = true;
      (grid.material as T.Material).opacity = 0.32;
      world.add(grid);
      for (const r of [5.5, 8.5]) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(r, r + 0.03, 96),
          new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        world.add(ring);
      }

      // Bâtiment : niveaux en verre + arêtes lumineuses, construits l'un après l'autre
      const FLOORS = 9;
      const floorH = 0.95;
      const floors: { group: T.Group; delay: number }[] = [];
      const glass = new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.16, depthWrite: false });
      const edgeMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.95 });
      const accentMat = new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.9 });
      for (let i = 0; i < FLOORS; i++) {
        const w = 4.2 - (i > 5 ? (i - 5) * 0.35 : 0);
        const d = 3.2 - (i > 5 ? (i - 5) * 0.25 : 0);
        const geo = new THREE.BoxGeometry(w, floorH * 0.92, d);
        const group = new THREE.Group();
        const box = new THREE.Mesh(geo, glass);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), i % 3 === 2 ? accentMat : edgeMat);
        group.add(box, edges);
        // Montants verticaux (ossature calculée)
        for (const [x, z] of [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [-w / 2, d / 2],
          [w / 2, d / 2],
        ]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, floorH, 0.06), new THREE.MeshBasicMaterial({ color: ORANGE }));
          col.position.set(x, 0, z);
          group.add(col);
        }
        group.position.y = floorH / 2 + i * floorH;
        group.scale.set(1, 0.001, 1);
        world.add(group);
        floors.push({ group, delay: 0.35 + i * 0.32 });
      }

      // Grue : mât + flèche qui pivote
      const crane = new THREE.Group();
      const mast = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 11.5, 0.35)), accentMat);
      mast.position.set(3.6, 5.75, -2.4);
      const jib = new THREE.Group();
      const arm = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 0.28, 0.28)), accentMat);
      arm.position.x = 2.2;
      const cable = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(5.5, 0, 0), new THREE.Vector3(5.5, -3.2, 0)]),
        new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.6 }),
      );
      jib.add(arm, cable);
      jib.position.set(3.6, 11.5, -2.4);
      crane.add(mast, jib);
      world.add(crane);

      // Plan de scan (contrôle qualité) qui balaie le bâtiment
      const scan = new THREE.Mesh(
        new THREE.PlaneGeometry(6.5, 5.2),
        new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
      );
      scan.rotation.x = -Math.PI / 2;
      world.add(scan);

      // Particules « données »
      const count = 420;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 26;
        positions[i * 3 + 1] = Math.random() * 14;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: BLUE, size: 0.06, transparent: true, opacity: 0.75 }));
      world.add(particles);

      let pointerX = 0;
      let pointerY = 0;
      const onPointer = (e: PointerEvent) => {
        pointerX = e.clientX / window.innerWidth - 0.5;
        pointerY = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      io.observe(el);

      const clock = new THREE.Clock();
      const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
      let raf = 0;
      const render = () => {
        raf = requestAnimationFrame(render);
        if (!visible || document.hidden) return;
        const t = reduce ? 99 : clock.getElapsedTime();
        for (const f of floors) f.group.scale.y = Math.max(0.001, ease((t - f.delay) / 0.8));
        world.rotation.y = reduce ? 0.6 : t * 0.08 + pointerX * 0.35;
        camera.position.y = 11 + pointerY * -1.6;
        camera.lookAt(0, 4.2, 0);
        jib.rotation.y = Math.sin(t * 0.35) * 0.9;
        const top = FLOORS * floorH;
        scan.position.y = reduce ? top * 0.6 : ((t * 1.4) % (top + 1.2)) - 0.2;
        (scan.material as T.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 3) * 0.04;
        particles.rotation.y = -t * 0.02;
        renderer.render(scene, camera);
      };
      render();

      const onResize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("resize", onResize);
        scene.traverse((obj) => {
          const mesh = obj as T.Mesh;
          mesh.geometry?.dispose?.();
          const mat = mesh.material as T.Material | T.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden="true" />;
}
