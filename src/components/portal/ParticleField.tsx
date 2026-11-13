import { useEffect, useRef } from "react";

/** Interactive constellation background (three.js), loaded only in the browser. */
export function ParticleField({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (disposed) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 14;

      const count = window.innerWidth < 640 ? 500 : 1400;
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const violet = new THREE.Color("#8b5cf6"), white = new THREE.Color("#e2e8f0");
      for (let i = 0; i < count; i++) {
        const r = 6 + Math.random() * 10, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
        pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t) * 0.6, r * Math.cos(p)], i * 3);
        const c = Math.random() < 0.35 ? violet : white;
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.012, 8, 160),
        new THREE.MeshBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.35 }),
      );
      ring.rotation.x = 1.2;
      scene.add(ring);

      const mouse = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        mouse.x = e.clientX / window.innerWidth - 0.5;
        mouse.y = e.clientY / window.innerHeight - 0.5;
      };
      const resize = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onMove);

      let raf = 0;
      const clock = new THREE.Clock();
      const tick = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!reduce) {
          points.rotation.y += dt * 0.03;
          ring.rotation.z += dt * 0.08;
        }
        camera.position.x += (mouse.x * 3 - camera.position.x) * 0.04;
        camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
      el.dataset.sceneReady = "true";
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        geo.dispose(); mat.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    });
    return () => { disposed = true; cleanup(); };
  }, []);
  return <div ref={ref} aria-hidden className={className} />;
}
