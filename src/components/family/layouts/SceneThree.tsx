import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useLineStore } from "@/store/line-store";
import { computeDimensionsLabel, maxRadius, remapProfile, resolveVariants, type Variant } from "@/lib/line-math";
import { computeClusterX, declumpCircles } from "@/lib/cluster-layout";
import { buildVesselGeometry } from "@/lib/three-vessel";
import { useElementSize } from "@/hooks/use-element-size";

const BODY_TONES = [0xd8cebd, 0xdcd2c2, 0xd3c8b6, 0xe0d7c8];
const PAPER = 0xf7f2e7;
const CLICK_DRAG_THRESHOLD = 5;
const MAX_ORBIT_DISTANCE = 400;

type VesselMesh = { mesh: THREE.Mesh; variant: Variant; heightUnits: number };

/**
 * "still life · 3D" — a real, orbitable 3D still life. Placement reuses the
 * same "studio wall" clustering algorithm as the 2D organic layout (see
 * cluster-layout.ts), with an explicit separation pass since actual 3D
 * volumes (unlike overlapping ink outlines) need to not clip through each
 * other. Vessels are lathe-revolved solids with a real wall thickness and
 * an open rim (see three-vessel.ts) — no flat cap anywhere.
 */
export function SceneThree({ className }: { className?: string }) {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();

  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);
  const adapt = useLineStore((s) => s.adapt);
  const vesselSet = useLineStore((s) => s.vesselSet);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const vesselsRef = useRef<VesselMesh[]>([]);
  const hasFramedRef = useRef(false);
  const selectedRef = useRef(-1);
  const labelRef = useRef<HTMLDivElement | null>(null);

  const [selected, setSelected] = useState(-1);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Effect A — one-time renderer/scene/camera/controls/lights setup + render loop. Runs once; cleans up on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A fresh camera/controls pair means "not yet framed" even if this effect
    // re-fires (e.g. React StrictMode's dev-only double-invoke) — otherwise a
    // recreated camera can be left sitting at its default (0,0,0) position.
    hasFramedRef.current = false;

    const scene = new THREE.Scene();
    // Starts well past the farthest the camera can ever orbit (see
    // controls.maxDistance below), so it never fades the vessels themselves
    // — just a faint atmospheric touch on anything further out.
    scene.fog = new THREE.Fog(PAPER, MAX_ORBIT_DISTANCE * 1.2, MAX_ORBIT_DISTANCE * 2.4);
    sceneRef.current = scene;

    // near/far kept as tight as the scene allows (orbit tops out at
    // MAX_ORBIT_DISTANCE, fog finishes well before 1000) — a wide near:far
    // ratio starves the depth buffer of precision at distance, which is
    // exactly what caused the coplanar ground/vessel-base z-fighting to
    // reappear when zoomed out.
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in this three.js version (silently falls
    // back to the hard-edged PCFShadowMap) — VSMShadowMap is the current way
    // to get an actually-blurred, smooth shadow.
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.outline = "none";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const hemi = new THREE.HemisphereLight(0xfffaf0, 0xdcd3c0, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.35);
    sun.position.set(60, 90, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    sun.shadow.bias = -0.0015;
    sun.shadow.radius = 12;
    sun.shadow.blurSamples = 24;
    scene.add(sun);
    lightRef.current = sun;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.15 }));
    ground.rotation.x = -Math.PI / 2;
    // Sits a hair below the vessels' feet (also at y=0) so the two coplanar
    // surfaces don't z-fight and flicker as the camera orbits.
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = MAX_ORBIT_DISTANCE;
    controls.maxPolarAngle = Math.PI * 0.49;
    controlsRef.current = controls;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downPos: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (moved > CLICK_DRAG_THRESHOLD) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(vesselsRef.current.map((v) => v.mesh));
      if (hits.length) {
        const idx = vesselsRef.current.findIndex((v) => v.mesh === hits[0].object);
        setSelected((prev) => (prev === idx ? -1 : idx));
      } else {
        setSelected(-1);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);

      const idx = selectedRef.current;
      const label = labelRef.current;
      if (label) {
        if (idx >= 0 && vesselsRef.current[idx]) {
          const { mesh, heightUnits } = vesselsRef.current[idx];
          const top = new THREE.Vector3(mesh.position.x, mesh.position.y + heightUnits, mesh.position.z);
          top.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          const left = (top.x * 0.5 + 0.5) * rect.width;
          const y = (-top.y * 0.5 + 0.5) * rect.height;
          label.style.transform = `translate(${left}px, ${y}px)`;
          label.style.opacity = top.z < 1 ? "1" : "0";
        } else {
          label.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      vesselsRef.current.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      vesselsRef.current = [];
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect B — keep the renderer/camera sized to the container.
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera || !size.width || !size.height) return;
    renderer.setSize(size.width, size.height, true);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [size.width, size.height]);

  // Effect C — rebuild vessel meshes whenever the profile/height/adaptation/vessel-set changes.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const light = lightRef.current;
    if (!scene || !camera || !controls || !light || !controlPoints) return;

    vesselsRef.current.forEach(({ mesh }) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    vesselsRef.current = [];
    setSelected(-1);

    const mR = Math.max(0.2, maxRadius(controlPoints));
    const variants = resolveVariants(vesselSet, mR);
    const vesselData = variants.map((v) => {
      const rc = remapProfile(controlPoints, v.w, v.h, adapt);
      const heightUnits = Math.max(0.5, heightCm * v.h);
      const radiusUnits = Math.max(0.5, maxRadius(rc) * heightUnits);
      return { variant: v, rc, heightUnits, radiusUnits };
    });

    const placedX = computeClusterX(vesselData, {
      widthOf: (d) => d.radiusUnits * 2,
      heightOf: (d) => d.heightUnits,
      spacingFactor: 1.3,
    });
    const numGroups = Math.max(1, new Set(placedX.map((p) => p.groupIndex)).size);
    const avgRadius = vesselData.reduce((s, d) => s + d.radiusUnits, 0) / vesselData.length;
    const zStep = avgRadius * 2.1;
    const withZ = placedX.map((p) => ({
      ...p,
      z: (p.groupIndex - (numGroups - 1) / 2) * zStep,
      radius: p.item.radiusUnits,
    }));
    const separated = declumpCircles(withZ, avgRadius * 0.5, 10);

    const centroid = separated.reduce(
      (acc, p) => ({ x: acc.x + p.x / separated.length, z: acc.z + p.z / separated.length }),
      { x: 0, z: 0 },
    );

    const maxHeight = Math.max(...vesselData.map((d) => d.heightUnits));
    const newMeshes: VesselMesh[] = separated.map((p, i) => {
      const d = vesselData[i];
      const geometry = buildVesselGeometry(d.rc, d.heightUnits);
      const material = new THREE.MeshStandardMaterial({
        color: BODY_TONES[i % BODY_TONES.length],
        roughness: 0.88,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(p.x, 0, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { mesh, variant: d.variant, heightUnits: d.heightUnits };
    });
    vesselsRef.current = newMeshes;

    const groundRadius = Math.max(...separated.map((p) => Math.hypot(p.x - centroid.x, p.z - centroid.z) + p.radius), avgRadius);
    light.shadow.camera.left = -groundRadius * 2.2;
    light.shadow.camera.right = groundRadius * 2.2;
    light.shadow.camera.top = groundRadius * 2.2;
    light.shadow.camera.bottom = -groundRadius * 2.2;
    light.shadow.camera.updateProjectionMatrix();
    light.target.position.set(centroid.x, 0, centroid.z);
    light.target.updateMatrixWorld();

    const targetY = maxHeight * 0.32;
    const target = { x: centroid.x, y: targetY, z: centroid.z };
    controls.target.set(target.x, target.y, target.z);

    // The true max distance from the look-at target to any vessel's rim or
    // base edge — the radius of a sphere around `target` that contains the
    // whole composition, so the initial framing never crops anything.
    let boundingRadius = avgRadius;
    separated.forEach((p, i) => {
      const d = vesselData[i];
      const topDist = Math.hypot(p.x - target.x, d.heightUnits - target.y, p.z - target.z) + d.radiusUnits * 0.25;
      const baseDist = Math.hypot(p.x - target.x, 0 - target.y, p.z - target.z) + d.radiusUnits;
      boundingRadius = Math.max(boundingRadius, topDist, baseDist);
    });

    if (!hasFramedRef.current) {
      hasFramedRef.current = true;
      const halfFov = (camera.fov / 2) * (Math.PI / 180);
      const camDistance = (boundingRadius / Math.sin(halfFov)) * 1.18;
      const dir = new THREE.Vector3(0.5, 0.55, 0.8).normalize();
      camera.position.set(target.x + dir.x * camDistance, target.y + dir.y * camDistance, target.z + dir.z * camDistance);
    }
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlPoints, heightCm, adapt, vesselSet]);

  const selectedLabel =
    selected >= 0 && vesselsRef.current[selected] && controlPoints
      ? `${vesselsRef.current[selected].variant.label} · ${computeDimensionsLabel(
          heightCm,
          Math.max(0.2, maxRadius(controlPoints)),
          vesselsRef.current[selected].variant,
          adapt,
        )}`
      : "";

  return (
    <div ref={containerRef} className={className ?? "absolute inset-0"} style={{ overflow: "hidden" }}>
      {!controlPoints && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-foreground/40">
          the family appears once a line is drawn
        </div>
      )}
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] text-foreground/80 opacity-0 shadow-sm"
      >
        <span className="size-1.5 rounded-full bg-accent" />
        {selectedLabel}
      </div>
      {controlPoints && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10.5px] text-foreground/45">
          drag to orbit · scroll to zoom · tap a vessel to read its size
        </div>
      )}
    </div>
  );
}
