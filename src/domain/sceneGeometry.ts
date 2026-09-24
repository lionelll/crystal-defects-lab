import type { SceneId } from '../data/scenes';
import { add, intersectionConfig, scale, type IntersectionId, type Vec3 } from './geometry';

export const edgeCoreOffset = .38;
export const cubicSpacing = .75;
export const edgeBurgers = cubicSpacing;
export const screwPitch = cubicSpacing;
export const screwBaseY = -.3;
export const secondCrossSlipPlaneX = 1.25;
export const doubleCrossSlipPlaneX = -.9;
export const doubleCrossSlipParallelPlaneY = 1.1;
export const extendedDissociationStart = .25;
export const extendedSpacingAdjustStart = .5;
export const fccNearestNeighbor = .65;
export const fccLayerSpacing = fccNearestNeighbor * Math.sqrt(2 / 3);
export const leadingShockleyLocal: Vec3 = [fccNearestNeighbor / 2, 0, -fccNearestNeighbor / (2 * Math.sqrt(3))];
export const trailingShockleyLocal: Vec3 = [fccNearestNeighbor / 2, 0, fccNearestNeighbor / (2 * Math.sqrt(3))];
export const fullFccBurgersLocal: Vec3 = [fccNearestNeighbor, 0, 0];

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
export function smoothRange(progress: number, start: number, end: number) {
  const value = clamp((progress - start) / (end - start));
  return value * value * (3 - 2 * value);
}

export function edgeState(id: SceneId, progress: number) {
  const p = clamp(progress);
  return {
    x: id === 'edge-glide' ? -2.1 + 4.65 * p : edgeCoreOffset,
    y: id === 'edge-climb' ? cubicSpacing * smoothRange(p, .66, 1) : 0,
  };
}

export function screwState(id: SceneId, progress: number) {
  const p = clamp(progress);
  return {
    x: id === 'screw-glide' ? -1.25 + 2.5 * p : id === 'cross-slip' ? secondCrossSlipPlaneX * smoothRange(p, 0, .5) : 0,
    y: screwBaseY + (id === 'cross-slip' ? 1.1 * smoothRange(p, .5, 1) : 0),
  };
}

export function vacancyPosition(progress: number): { position: Vec3; radius: number } | null {
  const p = clamp(progress);
  if (p >= .66) return null;
  const x = -2 * cubicSpacing + cubicSpacing * smoothRange(p, .1, .3) + cubicSpacing * smoothRange(p, .3, .5);
  const absorption = smoothRange(p, .5, .66);
  const core = edgeState('edge-climb', p);
  return {
    position: [x + (core.x - x) * absorption, cubicSpacing + (.48 + core.y - cubicSpacing) * absorption, 0],
    radius: .16 * (1 - absorption),
  };
}

function screwAngle(x: number, y: number, coreX: number, coreY: number) {
  const angle = Math.atan2(y - coreY, x - coreX);
  // A material point must stay on the same angular branch while the core
  // crosses its row during cross-slip; the swept area retains the full-b step.
  return y >= screwBaseY && y < coreY && x < coreX ? angle + 2 * Math.PI : angle;
}

export function cubicAtomPosition(id: SceneId, progress: number, i: number, j: number, k: number): Vec3 {
  const p = clamp(progress);
  let x = i * .75;
  let y = j * .75;
  let z = k * .75;
  if (id === 'edge' || id === 'edge-glide' || id === 'edge-climb') {
    const core = edgeState(id, p);
    const above = id === 'edge-climb' ? smoothRange(y - core.y, -.3, .3) : Number(y > core.y + .1);
    const elastic = id === 'edge-glide' ? 1 - smoothRange(p, .8, 1) : 1;
    x -= .12 * above * Math.tanh((x - core.x) * 1.4) * elastic;
    if (id === 'edge-glide' && y < core.y) x += edgeBurgers * smoothRange(core.x - x, -.28, .28);
    y += (.06 * above - .025 * (1 - above)) * Math.exp(-Math.abs(x - core.x));
    if (id === 'edge-climb' && j === 1 && k === 0) {
      if (i === -1) x -= cubicSpacing * smoothRange(p, .1, .3);
      if (i === 0) x -= cubicSpacing * smoothRange(p, .3, .5);
      if (i === -2) {
        const transfer = smoothRange(p, .5, .85);
        x = core.x * (1 - transfer);
        y = (.48 + core.y) * (1 - transfer) + cubicSpacing * transfer;
      }
    }
  } else if (id === 'screw' || id === 'screw-glide' || id === 'cross-slip') {
    const core = screwState(id, p);
    z += screwPitch * screwAngle(x, y, core.x, core.y) / (2 * Math.PI);
  }
  return [x, y, z];
}

export function partialSeparation(id: SceneId, progress: number, spacing: number) {
  if (id === 'extended') return spacing * smoothRange(progress, extendedDissociationStart, 1);
  if (id === 'shockley') return 1.6;
  return 0;
}

/** Local x || [1 -1 0], y || [1 1 1], z || [-1 -1 2].
 * A/B/C occupy the hollow positions of successive close-packed {111} layers. */
export function fccLatticePosition(i: number, j: number, layer: number): Vec3 {
  const stack = ((layer % 3) + 3) % 3;
  const a = fccNearestNeighbor;
  return [
    (i + j / 2 + stack / 2) * a,
    layer * fccLayerSpacing,
    (j * Math.sqrt(3) / 2 - stack / (2 * Math.sqrt(3))) * a,
  ];
}

/** Smoothed Volterra cut: the two partial steps sum to one full lattice
 * translation. The smooth core is illustrative, not an atomistic relaxation. */
export function fccAtomPosition(i: number, j: number, layer: number, separation: number): { position: Vec3; inFault: boolean } {
  const [x, y, z] = fccLatticePosition(i, j, layer);
  const coreWidth = .12;
  const first = layer > 0 ? smoothRange(x, -separation / 2 - coreWidth, -separation / 2 + coreWidth) : 0;
  const second = layer > 0 ? smoothRange(x, separation / 2 - coreWidth, separation / 2 + coreWidth) : 0;
  const inFault = layer === 1 && separation > .12 && x > -separation / 2 && x < separation / 2;
  return {
    position: [x + leadingShockleyLocal[0] * first + trailingShockleyLocal[0] * second,
      y,
      z + leadingShockleyLocal[2] * first + trailingShockleyLocal[2] * second],
    inFault,
  };
}

/** Intrinsic Frank fault loop: remove a disk from one {111} layer and let the
 * adjacent upper layer close along the plane normal. This is a teaching
 * construction, not an atomistically relaxed defect core. */
export function frankFaultAtomPosition(i: number, j: number, layer: number): { position: Vec3; inFault: boolean; missing: boolean } {
  const base = fccLatticePosition(i, j, layer);
  const inside = base[0] * base[0] + base[2] * base[2] < 1.24 * 1.24;
  return {
    position: [base[0], base[1] - (inside && layer > 0 ? fccLayerSpacing : 0), base[2]],
    inFault: inside && (layer === 0 || layer === 1),
    missing: inside && layer === 0,
  };
}

function jogLine(center: Vec3, line: Vec3, offset: Vec3, jog: number): Vec3[] {
  return [
    add(center, scale(line, -2.25)),
    add(center, scale(line, -.35)),
    add(center, scale(line, -.12)),
    add(add(center, scale(line, .12)), scale(offset, jog)),
    add(add(center, scale(line, .35)), scale(offset, jog)),
    add(add(center, scale(line, 2.25)), scale(offset, jog)),
  ];
}

export function intersectionFrame(id: IntersectionId, progress: number) {
  const config = intersectionConfig(id);
  const approach = 1 - 2 * smoothRange(progress, .04, .92);
  const jog = cubicSpacing * smoothRange(progress, .48, .58);
  const center1 = scale(config.from1, approach);
  const center2 = scale(config.from2, approach);
  return { config, center1, center2, jog, line1: jogLine(center1, config.l1, config.b2, jog), line2: jogLine(center2, config.l2, config.b1, jog) };
}

export function doubleCrossSlipState(progress: number) {
  const approach = smoothRange(progress, .12, .44);
  const firstTransfer = smoothRange(progress, .44, .62);
  const bow = smoothRange(progress, .62, .86);
  const recovery = 1 - smoothRange(progress, .86, .96);
  const targetX = [-1.6, -.9, -.9, -.9, -.9, -.9, -.9, -.9, -.9, -1.6];
  const z = [-2, -1.25, -.85, -.55, -.2, .2, .55, .85, 1.25, 2];
  const line = targetX.map((x, index): Vec3 => [
    -1.6 + (x + 1.6) * approach + (index === 4 || index === 5 ? 1.7 * bow * recovery : 0),
    index >= 3 && index <= 6 ? doubleCrossSlipParallelPlaneY * firstTransfer : 0,
    z[index],
  ]);
  const connectedArc: Vec3[] | null = progress >= .62 && progress < .92
    ? Array.from({ length: 33 }, (_, index): Vec3 => {
      const t = index / 32;
      return [doubleCrossSlipPlaneX - .45 * bow * Math.sin(Math.PI * t), doubleCrossSlipParallelPlaneY, -.55 + 1.1 * t];
    })
    : null;
  const connectedArcOpacity = 1 - smoothRange(progress, .86, .92);
  const detached = smoothRange(progress, .86, 1);
  return {
    line,
    connectedArc,
    connectedArcOpacity,
    loopRadiusX: progress > .86 ? 1.075 + .3 * detached : null,
    loopRadiusZ: progress > .86 ? .6 + .2 * detached : null,
    loopOpacity: smoothRange(progress, .86, .92),
    loopCenter: [-.275 + .4 * detached, doubleCrossSlipParallelPlaneY, 0] as Vec3,
  };
}
