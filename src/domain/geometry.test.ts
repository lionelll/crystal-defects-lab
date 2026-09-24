import { describe, expect, it } from 'vitest';
import { add, dot, fcc111Normal, frankBurgers, frankReadLoopCount, frankReadState, fullFccBurgers, intersectionConfig, isJog, leadingShockley, trailingShockley, type IntersectionId } from './geometry';
import { modules, scenes } from '../data/scenes';
import { seekProgress, stageAt, stepProgress } from '../app/playback';

describe('PRD first-edition scene coverage', () => {
  it('contains five modules and fifteen distinct scenes', () => {
    expect(modules).toHaveLength(5);
    expect(scenes).toHaveLength(15);
    expect(new Set(scenes.map(scene => scene.id)).size).toBe(15);
    expect(modules.map(module => scenes.filter(scene => scene.module === module.id).length)).toEqual([2, 4, 2, 4, 3]);
  });
  it('maps the start and end of an animation to its teaching stages', () => {
    const source = scenes.find(scene => scene.id === 'frank-read')!;
    expect(stageAt(source, 0)).toBe('固定源段');
    expect(stageAt(source, 1)).toBe('第二个环生成');
    expect(stageAt(source, .384)).toBe('受力弓出');
    expect(stageAt(source, .385)).toBe('首个环脱离');
    const doubleSlip = scenes.find(scene => scene.id === 'double-cross-slip')!;
    expect(stageAt(doubleSlip, .75)).toBe('第二次交滑移');
    expect(stageAt(doubleSlip, .8)).toBe('环形成');
  });
  it('steps to physical stage boundaries rather than arbitrary percentages', () => {
    const source = scenes.find(scene => scene.id === 'frank-read')!;
    expect(stepProgress(source, 0)).toBeCloseTo(.05);
    expect(stepProgress(source, .05)).toBeCloseTo(.385);
    expect(stepProgress(source, .865)).toBe(1);
    expect(stepProgress(source, 1)).toBeCloseTo(1.05);
    const extended = scenes.find(scene => scene.id === 'extended')!;
    expect(stepProgress(extended, 0)).toBeCloseTo(.25);
    expect(stepProgress(extended, .25)).toBeCloseTo(.5);
    expect(stageAt(extended, .5)).toBe('部分位错分离');
  });
  it('seeks within the current Frank–Read cycle without erasing completed cycles', () => {
    const source = scenes.find(scene => scene.id === 'frank-read')!;
    const glide = scenes.find(scene => scene.id === 'edge-glide')!;
    expect(seekProgress(source, 1.2, .5)).toBeCloseTo(1.5);
    expect(seekProgress(source, 2.8, .25)).toBeCloseTo(2.25);
    expect(seekProgress(source, 1.2, 1)).toBeGreaterThan(1.99);
    expect(seekProgress(source, 1.2, 1)).toBeLessThan(2);
    expect(frankReadLoopCount(seekProgress(source, 1.2, 1))).toBe(4);
    expect(seekProgress(glide, .8, .25)).toBeCloseTo(.25);
  });
});

describe('FCC partial Burgers vectors', () => {
  it('conserves the full Burgers vector and keeps Shockley partials in (111)', () => {
    const total = add(leadingShockley, trailingShockley);
    total.forEach((value, i) => expect(value).toBeCloseTo(fullFccBurgers[i], 8));
    expect(dot(leadingShockley, fcc111Normal)).toBeCloseTo(0, 8);
    expect(dot(trailingShockley, fcc111Normal)).toBeCloseTo(0, 8);
  });
  it('places the Frank partial normal to the (111) fault', () => {
    const normalRatio = frankBurgers[0] / fcc111Normal[0];
    frankBurgers.forEach((value, i) => expect(value / fcc111Normal[i]).toBeCloseTo(normalRatio, 8));
  });
});

describe('intersection candidate geometry', () => {
  const ids: IntersectionId[] = ['edge-edge-perpendicular', 'edge-edge-parallel', 'screw-screw', 'edge-screw'];
  it.each(ids)('%s begins with two separated lines and orthogonal b choices where required', id => {
    const c = intersectionConfig(id);
    expect(c.from1).not.toEqual(c.from2);
    if (id === 'edge-edge-parallel') expect(dot(c.b1, c.b2)).toBeCloseTo(1);
    else expect(dot(c.b1, c.b2)).toBeCloseTo(0);
    if (id.startsWith('edge-edge')) { expect(dot(c.l1, c.b1)).toBeCloseTo(0); expect(dot(c.l2, c.b2)).toBeCloseTo(0); }
    if (id === 'screw-screw') { expect(dot(c.l1, c.b1)).toBeCloseTo(1); expect(dot(c.l2, c.b2)).toBeCloseTo(1); }
    expect(dot(c.n1, c.from1)).toBeCloseTo(0);
    expect(dot(c.n2, c.from2)).toBeCloseTo(0);
  });
  it('distinguishes the selected edge–screw jog from its kink', () => {
    const c = intersectionConfig('edge-screw');
    expect(isJog(c.b2, c.n1)).toBe(true);
    expect(isJog(c.b1, c.n2)).toBe(false);
  });
  it('treats the selected parallel-b edge intersection as in-plane kinks', () => {
    const c = intersectionConfig('edge-edge-parallel');
    expect(isJog(c.b2, c.n1)).toBe(false);
    expect(isJog(c.b1, c.n2)).toBe(false);
  });
});

describe('Frank–Read source topology', () => {
  it('keeps both pinning points fixed throughout two generations', () => {
    for (const p of [0, .1, .25, .36, .4, .54, .6, .86, 1]) {
      const source = frankReadState(p).source;
      expect(source[0]).toEqual([-2, 0, 0]);
      expect(source.at(-1)).toEqual([2, 0, 0]);
    }
  });
  it('creates a loop only after self-contact, then produces a second loop', () => {
    expect(frankReadState(.34).loops).toHaveLength(0);
    expect(frankReadState(.36).inContact).toBe(true);
    expect(frankReadState(.4).loops).toHaveLength(1);
    expect(frankReadState(.75).loops).toHaveLength(1);
    expect(frankReadState(.9).loops).toHaveLength(2);
  });
  it('moves its bow continuously away from the topological split', () => {
    const before = frankReadState(.20).source[4];
    const after = frankReadState(.201).source[4];
    expect(Math.abs(after[1] - before[1])).toBeLessThan(.03);
  });
  it.each([.55 * .7, .55 + .45 * .7])('keeps the source curve continuous across loop separation at %s', boundary => {
    const before = frankReadState(boundary - .00001);
    const after = frankReadState(boundary + .00001);
    expect(before.source).toHaveLength(9);
    expect(after.source).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      const distance = Math.hypot(...before.source[i].map((value, axis) => value - after.source[i][axis]));
      expect(distance).toBeLessThan(.01);
    }
    expect(after.loops).toHaveLength(before.loops.length + 1);
    expect(after.loops.at(-1)!.opacity).toBeLessThan(.01);
  });
  it('starts detached loops at the contact curve and fades them in as the source recovers', () => {
    const contact = frankReadState(.385);
    const later = frankReadState(.5);
    expect(contact.source[4][1]).toBeCloseTo(2.95);
    expect(contact.loops[0].center[1] + contact.loops[0].radius).toBeCloseTo(2.95);
    expect(contact.loops[0].opacity).toBe(0);
    expect(later.loops[0].opacity).toBeGreaterThan(.9);
    expect(Math.abs(later.source[4][1])).toBeLessThan(.5);
    expect(later.loops[0].center[1] + later.loops[0].radius).toBeLessThan(3.2);
    for (const p of [.4, .9, 1.4]) {
      expect(frankReadState(p).source.every(point => point[2] === 0)).toBe(true);
      expect(frankReadState(p).loops.every(loop => loop.center[2] === 0)).toBe(true);
    }
  });
  it('keeps multiplying across playback cycles without erasing emitted rings at the cycle boundary', () => {
    const before = frankReadState(.99999);
    const after = frankReadState(1.00001);
    expect(frankReadLoopCount(1.4)).toBe(3);
    expect(frankReadLoopCount(1.9)).toBe(4);
    expect(before.loops).toHaveLength(2);
    expect(after.loops).toHaveLength(2);
    expect(after.loops[0].radius - before.loops[0].radius).toBeLessThan(.01);
    expect(after.source[0]).toEqual(before.source[0]);
    expect(frankReadState(1.4).loops).toHaveLength(3);
  });
});
