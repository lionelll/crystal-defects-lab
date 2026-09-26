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
  loops: { center: Vec3; radiusX: number; radiusY: number; opacity: number; points: Vec3[] }[];
  inContact: boolean;
  contactOpacity: number;
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
  const gap = .2 * (1 - range(phase, .65, .7));
  const loopShape: Vec3[] = [
    [-2, 0, 0], [-1.15, -.48, 0], [-gap, -1.0, 0], [-2.4, -1.15, 0], [-2.5, .8, 0], [-1.35, 2.12, 0], [0, 2.55, 0],
    [1.35, 2.12, 0], [2.5, .8, 0], [2.4, -1.15, 0], [gap, -1.0, 0], [1.15, -.48, 0], [2, 0, 0],
  ];
  const beforeSeparation = loopShape.map((target, i) => {
    const u = i / (loopShape.length - 1);
    const straight: Vec3 = [-2 + 4 * u, 0, 0];
    const arched: Vec3 = [straight[0], Math.sin(Math.PI * u) * 1.95 * bow, 0];
    if (phase <= .48) return arched;
    // Lift the outer arc before it moves around the pin tails. This keeps
    // the single source line embedded until the instant of reconnection.
    const lifted: Vec3 = [arched[0], arched[1] + (i >= 3 && i <= 9 ? .75 : 0), 0];
    const spread: Vec3 = [i >= 3 && i <= 9 ? target[0] : lifted[0], lifted[1], 0];
    const inner: Vec3 = [i === 1 || i === 2 || i === 10 || i === 11 ? target[0] : spread[0], i === 1 || i === 2 || i === 10 || i === 11 ? target[1] : spread[1], 0];
    const t = fold;
    if (t < .2) return lerp(arched, lifted, smooth(t / .2));
    if (t < .5) return lerp(lifted, spread, smooth((t - .2) / .3));
    if (t < .75) return lerp(spread, inner, smooth((t - .5) / .25));
    return lerp(inner, target, smooth((t - .75) / .25));
  });
  beforeSeparation[0] = [-2, 0, 0];
  beforeSeparation[beforeSeparation.length - 1] = [2, 0, 0];
  const separationAt = p < .55 ? .385 : .865;
  const separatedAge = p - separationAt;
  const neck: Vec3[] = [loopShape[0], loopShape[1], [0, -1, 0], loopShape[11], loopShape[12]];
  const source = separatedAge >= 0
    ? neck.map(point => lerp(point, [point[0], 0, 0], range(separatedAge, 0, .04)))
    : beforeSeparation;
  const loops: FrankReadState['loops'] = [];
  for (let cycle = Math.max(0, cycles - 2); cycle <= cycles; cycle++) {
    for (const [index, offset] of [.385, .865].entries()) {
      const age = elapsed - cycle - offset;
      if (age < 0 || age > 2.3) continue;
      const separation = range(age, 0, .16);
      const opacity = 1 - range(age, 1.8, 2.3);
      const center: Vec3 = [0, .75 + (index === 0 ? .03 : .05) * separation, 0];
      const radiusX = 2.45 + .16 * separation + .25 * Math.max(0, age - .16);
      const radiusY = 1.8 + .12 * separation + .2 * Math.max(0, age - .16);
      const joinedContour: Vec3[] = [[0, -1, 0], [-2.4, -1.15, 0], [-2.5, .8, 0], [-1.35, 2.12, 0], [0, 2.55, 0], [1.35, 2.12, 0], [2.5, .8, 0], [2.4, -1.15, 0], [0, -1, 0]];
      const points = joinedContour.map((point, pointIndex): Vec3 => {
        const angle = -Math.PI / 2 - pointIndex * Math.PI / 4;
        const ellipse: Vec3 = [center[0] + radiusX * Math.cos(angle), center[1] + radiusY * Math.sin(angle), 0];
        return lerp(point, ellipse, range(age, 0, .04));
      });
      loops.push({
        center,
        radiusX,
        radiusY,
        opacity,
        points,
      });
    }
  }
  const contactOpacity = phase < .7 ? range(phase, .66, .7) : 0;
  return { source, loops, inContact: phase >= .68 && phase < .7, contactOpacity, generation, emittedLoopCount: frankReadLoopCount(elapsed) };
}
