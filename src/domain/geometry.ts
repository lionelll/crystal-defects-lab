export type Vec3 = readonly [number, number, number];
export type IntersectionId = 'edge-edge-perpendicular' | 'edge-edge-parallel' | 'screw-screw' | 'edge-screw';
export interface IntersectionConfig {
  l1: Vec3; b1: Vec3; l2: Vec3; b2: Vec3;
  from1: Vec3; from2: Vec3; n1: Vec3; n2: Vec3;
}

export function dot(a: Vec3, b: Vec3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function scale(a: Vec3, k: number): Vec3 { return [a[0] * k, a[1] * k, a[2] * k]; }
export function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function length(a: Vec3) { return Math.sqrt(dot(a, a)); }
export function normalize(a: Vec3): Vec3 { return scale(a, 1 / length(a)); }
export function near(a: number, b: number, tolerance = 1e-9) { return Math.abs(a - b) <= tolerance; }

export const fullFccBurgers: Vec3 = [.5, -.5, 0];
export const leadingShockley: Vec3 = [2 / 6, -1 / 6, -1 / 6];
export const trailingShockley: Vec3 = [1 / 6, -2 / 6, 1 / 6];
export const fcc111Normal: Vec3 = normalize([1, 1, 1]);
export const frankBurgers: Vec3 = [1 / 3, 1 / 3, 1 / 3];

export function intersectionConfig(id: IntersectionId): IntersectionConfig {
  switch (id) {
    case 'edge-edge-perpendicular': return { l1: [0, 0, 1], b1: [1, 0, 0], l2: normalize([1, 0, 1]), b2: [0, 1, 0], from1: [-1.5, 0, 0], from2: [0, -1.5, 0], n1: [0, 1, 0], n2: normalize([-1, 0, 1]) };
    case 'edge-edge-parallel': return { l1: [0, 0, 1], b1: [1, 0, 0], l2: [0, 1, 0], b2: [1, 0, 0], from1: [-1.5, 0, 0], from2: [1.5, 0, 0], n1: [0, 1, 0], n2: [0, 0, -1] };
    case 'screw-screw': return { l1: [0, 0, 1], b1: [0, 0, 1], l2: [1, 0, 0], b2: [1, 0, 0], from1: [0, -1.5, 0], from2: [0, 1.5, 0], n1: [1, 0, 0], n2: [0, 0, 1] };
    case 'edge-screw': return { l1: [0, 0, 1], b1: [1, 0, 0], l2: [0, 1, 0], b2: [0, 1, 0], from1: [-1.5, 0, 0], from2: [1.5, 0, 0], n1: [0, 1, 0], n2: [0, 0, 1] };
  }
}

export function isJog(offset: Vec3, normal: Vec3) { return Math.abs(dot(offset, normal)) > 1e-6; }

function clamp(t: number) { return Math.max(0, Math.min(1, t)); }
function smooth(t: number) { const v = clamp(t); return v * v * (3 - 2 * v); }
function range(t: number, a: number, b: number) { return smooth((t - a) / (b - a)); }
function lerp(a: Vec3, b: Vec3, t: number): Vec3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export interface FrankReadState {
  source: Vec3[];
  loops: { center: Vec3; radiusX: number; radiusY: number; opacity: number }[];
  inContact: boolean;
  generation: number;
  emittedLoopCount: number;
}

export function frankReadLoopCount(progress: number) {
  const elapsed = Math.max(0, progress);
  const cycles = Math.floor(elapsed);
  const local = elapsed - cycles;
  return cycles * 2 + Number(local >= .385) + Number(local >= .865);
}

export function frankReadState(progress: number): FrankReadState {
  const elapsed = Math.max(0, progress);
  const cycles = Math.floor(elapsed);
  const p = elapsed - cycles;
  const firstPhase = clamp(p / .55);
  const secondPhase = clamp((p - .55) / .45);
  const phase = p < .55 ? firstPhase : secondPhase;
  const generation = cycles * 2 + (p < .55 ? 1 : 2);
  const bow = range(phase, 0, .48);
  const fold = range(phase, .48, .7);
  const loopShape: Vec3[] = [[-2, 0, 0], [-2.18, .35, 0], [-2.35, 1.25, 0], [-1.35, 2.12, 0], [0, 2.55, 0], [1.35, 2.12, 0], [2.35, 1.25, 0], [0, -.75, 0], [2, 0, 0]];
  const source = loopShape.map((target, i) => {
    const u = i / (loopShape.length - 1);
    const straight: Vec3 = [-2 + 4 * u, 0, 0];
    if (phase < .7) return lerp([straight[0], Math.sin(Math.PI * u) * 1.95 * bow, 0], target, fold);
    return lerp(target, straight, range(phase, .7, .94));
  });
  source[0] = [-2, 0, 0];
  source[source.length - 1] = [2, 0, 0];
  const loops: FrankReadState['loops'] = [];
  for (let cycle = Math.max(0, cycles - 2); cycle <= cycles; cycle++) {
    for (const [index, offset] of [.385, .865].entries()) {
      const age = elapsed - cycle - offset;
      if (age < 0 || age > 2.3) continue;
      const separation = range(age, 0, .16);
      const opacity = range(age, 0, .10) * (1 - range(age, 1.8, 2.3));
      loops.push({
        center: [0, .75 + (index === 0 ? .03 : .05) * separation, 0],
        radiusX: 2.45 + .16 * separation + .25 * Math.max(0, age - .16),
        radiusY: 1.8 + .12 * separation + .2 * Math.max(0, age - .16),
        opacity,
      });
    }
  }
  return { source, loops, inContact: phase >= .64 && phase < .7, generation, emittedLoopCount: frankReadLoopCount(elapsed) };
}
