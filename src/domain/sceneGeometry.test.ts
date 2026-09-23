import { describe, expect, it } from 'vitest';
import { cubicAtomPosition, doubleCrossSlipParallelPlaneY, doubleCrossSlipPlaneX, doubleCrossSlipState, edgeState, extendedDissociationStart, extendedSpacingAdjustStart, fccAtomPosition, fccLatticePosition, fccNearestNeighbor, frankFaultAtomPosition, fullFccBurgersLocal, intersectionFrame, leadingShockleyLocal, partialSeparation, screwPitch, screwState, secondCrossSlipPlaneX, trailingShockleyLocal, vacancyLatticeIndex } from './sceneGeometry';

describe('edge and screw displacement geometry', () => {
  it('keeps edge glide in its plane while climb leaves that plane', () => {
    expect(edgeState('edge-glide', 0).y).toBe(0);
    expect(edgeState('edge-glide', 1).y).toBe(0);
    expect(edgeState('edge-glide', 1).x).toBeGreaterThan(edgeState('edge-glide', 0).x);
    expect(edgeState('edge-climb', 1).y).toBeCloseTo(1.15);
  });
  it('moves a vacancy through lattice sites before the climb', () => {
    expect([0, .25, .5, .6, .66].map(vacancyLatticeIndex)).toEqual([-2, -1, 0, 0, null]);
    expect(edgeState('edge-climb', .5).y).toBe(0);
    expect(edgeState('edge-climb', .66).y).toBe(0);
    expect(edgeState('edge-climb', .8).y).toBeGreaterThan(0);
  });
  it('uses an angular screw displacement and a continuous cross-slip core path', () => {
    const above = cubicAtomPosition('screw', 0, 1, 1, 0)[2];
    const below = cubicAtomPosition('screw', 0, 1, -1, 0)[2];
    expect(above - below).toBeCloseTo(screwPitch / 4, 8);
    expect(screwState('cross-slip', .5).y).toBe(0);
    expect(screwState('cross-slip', 1).x).toBeCloseTo(screwState('cross-slip', .5).x);
    expect(screwState('cross-slip', .5).x).toBeCloseTo(secondCrossSlipPlaneX);
    expect(screwState('cross-slip', 1).y).toBeGreaterThan(0);
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
    const meeting = intersectionFrame('edge-screw', .52);
    const after = intersectionFrame('edge-screw', 1);
    expect(before.center1).not.toEqual(before.center2);
    expect(before.jog).toBe(0);
    meeting.center1.forEach(value => expect(value).toBeCloseTo(0));
    meeting.center2.forEach(value => expect(value).toBeCloseTo(0));
    expect(meeting.jog).toBe(0);
    expect(after.jog).toBeGreaterThan(0);
  });
  it('shows both cross-slip transfers before the candidate loop', () => {
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
    expect(initial.loopRadius).toBeNull();
    expect(doubleCrossSlipState(.72).loopRadius).toBeNull();
    expect(doubleCrossSlipState(.78).loopRadius).toBeNull();
    expect(second.loopRadius).toBeNull();
    const closing = doubleCrossSlipState(.82);
    expect(closing.connectedArc).not.toBeNull();
    closing.connectedArc![0].forEach((value, axis) => expect(value).toBeCloseTo(closing.line[6][axis]));
    expect(closing.loopRadius).toBeNull();
    const connected = doubleCrossSlipState(.86);
    const detached = doubleCrossSlipState(.86001);
    expect(connected.connectedArc!.at(-1)![0]).toBeCloseTo(connected.connectedArc![0][0]);
    expect(connected.connectedArc!.at(-1)![2]).toBeCloseTo(connected.connectedArc![0][2]);
    expect(detached.connectedArc).toBeNull();
    expect(detached.loopRadius).toBeCloseTo(.55);
    expect(detached.loopCenter[0] - .55).toBeCloseTo(connected.line[6][0]);
    expect(doubleCrossSlipState(1).loopRadius).toBeGreaterThan(detached.loopRadius!);
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
