import { describe, expect, it } from 'vitest';
import { cubicAtomPosition, cubicSpacing, doubleCrossSlipParallelPlaneY, doubleCrossSlipPlaneX, doubleCrossSlipState, edgeBurgers, edgeGlideExitProgress, edgeState, extendedDissociationStart, extendedSpacingAdjustStart, fccAtomPosition, fccLatticePosition, fccNearestNeighbor, frankFaultAtomPosition, fullFccBurgersLocal, intersectionFrame, leadingShockleyLocal, partialSeparation, screwBaseY, screwPitch, screwState, secondCrossSlipPlaneX, trailingShockleyLocal, vacancyPosition } from './sceneGeometry';

describe('edge and screw displacement geometry', () => {
  it('keeps edge glide in its plane while climb leaves that plane', () => {
    expect(edgeState('edge-glide', 0).y).toBe(0);
    expect(edgeState('edge-glide', 1).y).toBe(0);
    expect(edgeState('edge-glide', 1).x).toBeGreaterThan(edgeState('edge-glide', 0).x);
    expect(edgeState('edge-climb', 1).y).toBeCloseTo(cubicSpacing);
    expect(edgeState('edge-glide', 1).x).toBeGreaterThan(3 * cubicSpacing);
    const bottom = cubicAtomPosition('edge-glide', 1, 0, -1, 0);
    const top = cubicAtomPosition('edge-glide', 1, 0, 1, 0);
    expect(bottom[0] - top[0]).toBeCloseTo(-edgeBurgers);
    expect(bottom[1]).toBeCloseTo(-cubicSpacing);
    expect(top[1]).toBeCloseTo(cubicSpacing);
    for (let step = 0; step <= 200; step++) {
      const progress = step / 200;
      for (let j = -2; j < 0; j++) for (let i = -3; i < 3; i++) {
        const left = cubicAtomPosition('edge-glide', progress, i, j, 0);
        const right = cubicAtomPosition('edge-glide', progress, i + 1, j, 0);
        expect(Math.hypot(...left.map((value, axis) => value - right[axis]))).toBeGreaterThan(.6);
      }
    }
  });
  it('moves the vacancy continuously through lattice sites before one-layer climb', () => {
    expect(vacancyPosition(0)?.position[0]).toBeCloseTo(-2 * cubicSpacing);
    expect(vacancyPosition(.2)!.position[0]).toBeGreaterThan(-2 * cubicSpacing);
    expect(vacancyPosition(.2)!.position[0]).toBeLessThan(-cubicSpacing);
    expect(vacancyPosition(.3)?.position[0]).toBeCloseTo(-cubicSpacing);
    expect(vacancyPosition(.5)?.position[0]).toBeCloseTo(0);
    expect(vacancyPosition(.66)).toBeNull();
    expect(edgeState('edge-climb', .5).y).toBe(0);
    expect(edgeState('edge-climb', .66).y).toBe(0);
    expect(edgeState('edge-climb', .8).y).toBeGreaterThan(0);
    for (let step = 1; step < 660; step++) {
      const before = vacancyPosition((step - 1) / 1000)!;
      const after = vacancyPosition(step / 1000)!;
      expect(Math.hypot(...before.position.map((value, axis) => value - after.position[axis]))).toBeLessThan(.025);
    }
  });
  it('keeps glide strain until the core exits and matches the static edge before climb begins', () => {
    expect(edgeGlideExitProgress).toBeGreaterThan(.93);
    expect(edgeGlideExitProgress).toBeLessThan(.94);
    expect(3 * cubicSpacing - cubicAtomPosition('edge-glide', .9, 3, 1, 0)[0]).toBeGreaterThan(.02);
    for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
      if (i === -2 && j === 1 && k === 0) continue; // Initial vacancy has no visible atom.
      expect(cubicAtomPosition('edge-climb', 0, i, j, k)).toEqual(cubicAtomPosition('edge', 0, i, j, k));
    }
  });
  it('uses an angular screw displacement and a continuous cross-slip core path', () => {
    expect(screwPitch).toBe(cubicSpacing);
    const above = cubicAtomPosition('screw', 0, 1, 1, 0)[2];
    const below = cubicAtomPosition('screw', 0, 1, -1, 0)[2];
    expect(above - below).toBeGreaterThan(0);
    expect(above - below).toBeLessThan(screwPitch / 2);
    expect(screwState('cross-slip', .5).y).toBe(screwBaseY);
    expect(screwState('cross-slip', 1).x).toBeCloseTo(screwState('cross-slip', .5).x);
    expect(screwState('cross-slip', .5).x).toBeCloseTo(secondCrossSlipPlaneX);
    expect(screwState('cross-slip', 1).y).toBeGreaterThan(0);
  });
  it('has no visible row-wide atom jumps in glide, cross-slip, or climb', () => {
    for (const id of ['screw-glide', 'cross-slip', 'edge-climb'] as const) {
      let maximum = 0;
      for (let step = 1; step <= 1000; step++) {
        const p = step / 1000;
        for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
          if (id === 'edge-climb' && i === -2 && j === 1 && k === 0) continue;
          const a = cubicAtomPosition(id, p - .001, i, j, k);
          const b = cubicAtomPosition(id, p, i, j, k);
          maximum = Math.max(maximum, Math.hypot(...a.map((value, axis) => value - b[axis])));
        }
      }
      expect(maximum, id).toBeLessThan(.01);
    }
  });
});

describe('FCC partial separation', () => {
  const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  it('places A/B/C close-packed layers in triangular hollows with equal nearest-neighbor spacing', () => {
    const A = fccLatticePosition(0, 0, 0);
    const B = fccLatticePosition(0, 0, 1);
    const C = fccLatticePosition(0, 0, 2);
    expect(distance(A, fccLatticePosition(1, 0, 0))).toBeCloseTo(fccNearestNeighbor);
    expect(distance(A, B)).toBeCloseTo(fccNearestNeighbor);
    expect(distance(B, C)).toBeCloseTo(fccNearestNeighbor);
    expect(distance(C, fccLatticePosition(1, -1, 3))).toBeCloseTo(fccNearestNeighbor);
    expect(fccLatticePosition(0, 0, 3)[0]).toBeCloseTo(A[0]);
    expect(fccLatticePosition(0, 0, 3)[2]).toBeCloseTo(A[2]);
    const neighbors: number[] = [];
    for (let layer = -2; layer <= 2; layer++) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      if (i === 0 && j === 0 && layer === 0) continue;
      const candidate = distance(A, fccLatticePosition(i, j, layer));
      if (Math.abs(candidate - fccNearestNeighbor) < 1e-8) neighbors.push(candidate);
    }
    expect(neighbors).toHaveLength(12);
  });
  it('uses two partial displacement steps whose sum is the full lattice translation', () => {
    const sum = leadingShockleyLocal.map((value, axis) => value + trailingShockleyLocal[axis]);
    sum.forEach((value, axis) => expect(value).toBeCloseTo(fullFccBurgersLocal[axis]));
    const displacement = (i: number, d: number) => {
      const base = fccLatticePosition(i, 0, 1);
      const moved = fccAtomPosition(i, 0, 1, d).position;
      return moved.map((value, axis) => value - base[axis]);
    };
    displacement(-3, 2).forEach(value => expect(value).toBeCloseTo(0));
    displacement(0, 2).forEach((value, axis) => expect(value).toBeCloseTo(leadingShockleyLocal[axis]));
    displacement(3, 2).forEach((value, axis) => expect(value).toBeCloseTo(fullFccBurgersLocal[axis]));
    expect(fccAtomPosition(0, 0, 1, 2).inFault).toBe(true);
    expect(fccAtomPosition(0, 0, 2, 2).inFault).toBe(false);
    const shiftedB = fccAtomPosition(0, 0, 1, 2).position;
    const C = fccLatticePosition(0, 0, 2);
    expect(shiftedB[0]).toBeCloseTo(C[0]);
    expect(shiftedB[2]).toBeCloseTo(C[2]);
  });
  it('widens the fault band between two partial lines', () => {
    const start = partialSeparation('extended', 0, 2);
    const middle = partialSeparation('extended', .5, 2);
    const end = partialSeparation('extended', 1, 2);
    expect(start).toBeLessThan(middle);
    expect(middle).toBeLessThan(end);
    expect(end).toBeCloseTo(2);
    expect(fccAtomPosition(0, 0, 1, end).inFault).toBe(true);
  });
  it('does not let spacing change the intact dislocation before dissociation begins', () => {
    expect(partialSeparation('extended', extendedDissociationStart, .7)).toBe(0);
    expect(partialSeparation('extended', extendedDissociationStart, 3)).toBe(0);
    expect(fccAtomPosition(0, 0, 0, 0).inFault).toBe(false);
    expect(fccAtomPosition(0, 0, 0, 0).position).toEqual([0, 0, 0]);
    expect(partialSeparation('extended', extendedSpacingAdjustStart, 3)).toBeGreaterThan(partialSeparation('extended', extendedSpacingAdjustStart, .7));
  });
  it('shows a missing {111} disk and normal closure in the Frank loop', () => {
    const removed = frankFaultAtomPosition(0, 0, 0);
    const upper = frankFaultAtomPosition(0, 0, 1);
    const unaffected = frankFaultAtomPosition(3, 3, 0);
    expect(removed.missing).toBe(true);
    expect(removed.inFault).toBe(true);
    expect(upper.position[1]).toBeCloseTo(0);
    expect(unaffected.missing).toBe(false);
    expect(frankFaultAtomPosition(0, 0, 2).inFault).toBe(false);
  });
});

describe('intersection and double cross-slip sequence', () => {
  it('starts separated, meets, then forms a local step', () => {
    const before = intersectionFrame('edge-screw', 0);
    const meeting = intersectionFrame('edge-screw', .48);
    const after = intersectionFrame('edge-screw', 1);
    expect(before.center1).not.toEqual(before.center2);
    expect(before.jog).toBe(0);
    meeting.center1.forEach(value => expect(value).toBeCloseTo(0));
    meeting.center2.forEach(value => expect(value).toBeCloseTo(0));
    expect(meeting.jog).toBe(0);
    expect(after.jog).toBeCloseTo(cubicSpacing);
    expect(after.center1[0]).toBeGreaterThan(0);
    expect(after.center2[0]).toBeLessThan(0);
    const lineWithoutJog = after.config.l1.map((value, axis) => after.center1[axis] + .12 * value);
    expect(Math.hypot(...after.line1[3].map((value, axis) => value - lineWithoutJog[axis]))).toBeCloseTo(cubicSpacing);
  });
  it('stops at the obstacle, transfers between planes, and bows a pinned segment into a loop', () => {
    const initial = doubleCrossSlipState(0);
    const first = doubleCrossSlipState(.45);
    const second = doubleCrossSlipState(.8);
    expect(new Set(initial.line.map(point => point[0])).size).toBe(1);
    expect(initial.line.every(point => point[1] === 0)).toBe(true);
    expect(initial.line[2][1]).toBe(0);
    expect(first.line[3][1]).toBeGreaterThan(0);
    expect(first.line[3][0]).toBeCloseTo(doubleCrossSlipPlaneX);
    expect(second.line[4][1]).toBeCloseTo(doubleCrossSlipParallelPlaneY);
    expect(second.line[4][0]).toBeGreaterThan(doubleCrossSlipPlaneX);
    for (let step = 0; step <= 62; step++) {
      const state = doubleCrossSlipState(step / 100);
      for (let index = 1; index < state.line.length; index++) {
        const a = state.line[index - 1], b = state.line[index];
        const segment = b.map((value, axis) => value - a[axis]);
        const towardObstacle = [-.55 - a[0], -a[1], -a[2]];
        const projection = Math.max(0, Math.min(1, segment.reduce((sum, value, axis) => sum + value * towardObstacle[axis], 0) / segment.reduce((sum, value) => sum + value * value, 0)));
        const closest = a.map((value, axis) => value + projection * segment[axis]);
        expect(Math.hypot(closest[0] + .55, closest[1], closest[2])).toBeGreaterThan(.29);
      }
    }
    expect(initial.loopRadiusX).toBeNull();
    expect(doubleCrossSlipState(.72).loopRadiusX).toBeNull();
    expect(doubleCrossSlipState(.78).loopRadiusX).toBeNull();
    expect(second.loopRadiusX).toBeNull();
    const closing = doubleCrossSlipState(.82);
    expect(closing.connectedArc).not.toBeNull();
    closing.connectedArc![0].forEach((value, axis) => expect(value).toBeCloseTo(closing.line[3][axis]));
    closing.connectedArc!.at(-1)!.forEach((value, axis) => expect(value).toBeCloseTo(closing.line[6][axis]));
    expect(closing.line[4][0]).toBeGreaterThan(closing.line[3][0]);
    expect(closing.connectedArc![16][0]).toBeLessThan(closing.line[3][0]);
    expect(closing.loopRadiusX).toBeNull();
    const connected = doubleCrossSlipState(.86);
    const detached = doubleCrossSlipState(.86001);
    expect(connected.connectedArc).not.toBeNull();
    expect(detached.connectedArc).not.toBeNull();
    expect(detached.loopRadiusX).toBeCloseTo(1.075);
    expect(detached.loopOpacity).toBeLessThan(.001);
    expect(doubleCrossSlipState(1).connectedArc).toBeNull();
    expect(doubleCrossSlipState(1).loopRadiusX).toBeGreaterThan(detached.loopRadiusX!);
    const final = doubleCrossSlipState(1);
    expect(final.loopCenter[0] - final.loopRadiusX!).toBeLessThan(final.line[3][0]);
    expect(final.loopCenter[0] + final.loopRadiusX!).toBeGreaterThan(final.line[6][0]);
    expect(Math.abs(final.loopCenter[0]) + final.loopRadiusX!).toBeLessThan(2.25);
    expect(final.loopRadiusZ!).toBeLessThan(2.25);
    expect(final.loopRadiusX! * final.loopRadiusZ!).toBeGreaterThan(4 * detached.loopRadiusX! * detached.loopRadiusZ!);
  });
  it('keeps the candidate source segments on the fixed A, B, or parallel C planes', () => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    const onSamePlane = (a: readonly number[], b: readonly number[]) =>
      (near(a[1], 0) && near(b[1], 0)) ||
      (near(a[0], doubleCrossSlipPlaneX) && near(b[0], doubleCrossSlipPlaneX)) ||
      (near(a[1], doubleCrossSlipParallelPlaneY) && near(b[1], doubleCrossSlipParallelPlaneY));
    for (let step = 0; step <= 100; step++) {
      const progress = step / 100;
      const line = doubleCrossSlipState(progress).line;
      for (let index = 1; index < line.length; index++) {
        expect(onSamePlane(line[index - 1], line[index])).toBe(true);
      }
    }
  });
});
