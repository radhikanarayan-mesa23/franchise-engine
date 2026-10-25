"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import brand from "@/config/brand.json";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Real-time 3D spectacles: polished titanium frame, tinted glass lenses with transmission,
    environment reflections. Phases in (fade, rise, spin-to-front), then floats and follows the pointer. */
export default function Glasses3D({ delay = 0.4 }: { delay?: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
    camera.position.set(0, 0.15, 7.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9adcf6, 1.4); rim.position.set(-4, 1, -3); scene.add(rim);

    // Materials
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xc9d6e2, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true });
    const accent = new THREE.MeshPhysicalMaterial({ color: 0x1e88d8, metalness: 0.9, roughness: 0.25, clearcoat: 1, transparent: true });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9adcf6, metalness: 0, roughness: 0.04, transmission: 0.92, thickness: 0.18, ior: 1.52,
      attenuationColor: new THREE.Color(0x1e88d8), attenuationDistance: 1.2, clearcoat: 1, side: THREE.DoubleSide, transparent: true });
    const mats = [metal, accent, glass];

    // Lens outline: a soft rounded trapezoid (premium wayfarer-ish)
    const W = 1.72, Hh = 1.3;
    const lensShape = () => {
      const s = new THREE.Shape(), w = W / 2, h = Hh / 2;
      s.moveTo(-w + 0.25, h);
      s.lineTo(w - 0.2, h); s.quadraticCurveTo(w + 0.02, h, w, h - 0.25);
      s.bezierCurveTo(w - 0.02, -h * 0.4, w * 0.55, -h, 0, -h);
      s.bezierCurveTo(-w * 0.6, -h, -w - 0.02, -h * 0.35, -w, h - 0.28);
      s.quadraticCurveTo(-w, h, -w + 0.25, h);
      return s;
    };
    const glassesGroup = new THREE.Group();
    const gap = 1.3;
    for (const side of [-1, 1]) {
      const shape = lensShape();
      const pts = shape.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x * side, p.y, 0));
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const rimMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.055, 20, true), metal);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), glass);
      lens.scale.x = side; lens.position.z = -0.01;
      const lensGroup = new THREE.Group();
      lensGroup.add(rimMesh, lens);
      lensGroup.position.x = side * gap;
      lensGroup.rotation.y = side * -0.06; // slight wrap
      glassesGroup.add(lensGroup);
      // Hinge block and temple arm sweeping back
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.2), accent);
      hinge.position.set(side * (gap + W / 2 + 0.03), Hh / 2 - 0.2, -0.05);
      glassesGroup.add(hinge);
      const temple = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (gap + W / 2 + 0.06), Hh / 2 - 0.2, -0.1),
        new THREE.Vector3(side * (gap + W / 2 + 0.12), Hh / 2 - 0.22, -1.6),
        new THREE.Vector3(side * (gap + W / 2 + 0.1), Hh / 2 - 0.4, -2.6),
        new THREE.Vector3(side * (gap + W / 2 + 0.02), Hh / 2 - 0.85, -2.95),
      ]);
      glassesGroup.add(new THREE.Mesh(new THREE.TubeGeometry(temple, 80, 0.045, 14, false), metal));
      // Nose pad
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), glass);
      pad.scale.set(0.7, 1.2, 0.5);
      pad.position.set(side * (gap - W / 2 + 0.22), -0.12, 0.12);
      glassesGroup.add(pad);
    }
    // Double bridge (top bar + arched bridge) in polished metal
    const bridge = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-(gap - W / 2) - 0.02, 0.28, 0), new THREE.Vector3(0, 0.62, 0.06), new THREE.Vector3(gap - W / 2 + 0.02, 0.28, 0));
    glassesGroup.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 60, 0.05, 16, false), metal));
    const brow = new THREE.CatmullRomCurve3([new THREE.Vector3(-gap - 0.55, Hh / 2 + 0.02, 0.02), new THREE.Vector3(0, Hh / 2 + 0.1, 0.06), new THREE.Vector3(gap + 0.55, Hh / 2 + 0.02, 0.02)]);
    glassesGroup.add(new THREE.Mesh(new THREE.TubeGeometry(brow, 80, 0.035, 12, false), accent));
    scene.add(glassesGroup);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 1.6 ? 8.6 : 7.2;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener("pointermove", onMove);

    const t0 = performance.now() + delay * 1000;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    let raf = 0;
    const loop = (now: number) => {
      const t = reduce ? 1 : Math.min(1, Math.max(0, (now - t0) / 1800));
      const e = ease(t), s = (now - t0) / 1000;
      mats.forEach((m) => (m.opacity = e));
      const float = reduce ? 0 : Math.sin(s * 1.1) * 0.06;
      glassesGroup.position.y = (1 - e) * 0.9 + float;
      glassesGroup.rotation.y = (1 - e) * -2.4 + (reduce ? 0 : Math.sin(s * 0.5) * 0.28 * e) + pointer.x * 0.25;
      glassesGroup.rotation.x = 0.12 + (1 - e) * 0.4 + pointer.y * 0.12;
      glassesGroup.scale.setScalar(0.8 + e * 0.2);
      renderer.render(scene, camera);
      if (!reduce || t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      mats.forEach((m) => m.dispose()); pmrem.dispose(); renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [delay]);

  return <div ref={host} className="glasses3d" aria-label={`${brand.name} spectacles`} role="img" />;
}
