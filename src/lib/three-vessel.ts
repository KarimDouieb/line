/**
 * Turns a profile (see line-math.ts) into an actual 3D vessel mesh
 * geometry: a lathe-revolved solid with a real wall thickness. The rim is
 * an open, thin "washer" edge rather than a flat cap (no flat top), and
 * the foot is closed with a solid disc so the vessel reads as sitting on
 * a surface. This is the only file that imports three — line-math.ts stays
 * framework-free.
 */
import * as THREE from "three";
import { maxRadius, type ControlPoint } from "@/lib/line-math";

export function buildVesselGeometry(
  cps: ControlPoint[],
  heightUnits: number,
  opts: { wallThickness?: number; radialSegments?: number } = {},
): THREE.LatheGeometry {
  const dense = cps; // already dense (see densifyCurve), ordered rim (y=0) -> foot (y=1)
  const mR = maxRadius(cps);
  const wallThickness = opts.wallThickness ?? Math.max(heightUnits * 0.012, mR * heightUnits * 0.05);
  const radialSegments = opts.radialSegments ?? 48;

  const toVec = (p: ControlPoint, r: number) => new THREE.Vector2(Math.max(0.0001, r), (1 - p.y) * heightUnits);

  const outerRimToFoot = dense.map((p) => toVec(p, p.r * heightUnits));
  const outerFootToRim = [...outerRimToFoot].reverse();
  const innerRimToFoot = dense.map((p) => toVec(p, p.r * heightUnits - wallThickness));

  const points: THREE.Vector2[] = [
    ...outerFootToRim, // foot -> rim, outer wall
    ...innerRimToFoot, // rim -> foot, inner wall (the gap between this and the outer pass at the rim is the wall thickness — no cap there, so no flat top)
    new THREE.Vector2(0, 0), // close to the axis at the foot — a solid base disc
  ];

  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}
