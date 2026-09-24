import { describe, expect, it } from 'vitest';
import { sceneById } from '../data/scenes';
import { defaultOptions, displayOptionsForScene } from './useLabController';

describe('scene display defaults', () => {
  it('starts glide scenes with optional stress and step overlays hidden', () => {
    const edge = displayOptionsForScene(defaultOptions, 'edge-glide');
    const screw = displayOptionsForScene(defaultOptions, 'screw-glide');
    expect([edge.atoms, edge.lattice, edge.line, edge.burgers, edge.plane, edge.trajectory, edge.extraHalfPlane, edge.stress].filter(Boolean)).toHaveLength(5);
    expect([screw.atoms, screw.lattice, screw.line, screw.burgers, screw.plane, screw.trajectory, screw.stress, screw.surfaceStep].filter(Boolean)).toHaveLength(4);
    expect(edge.trajectory).toBe(true);
    expect(edge.stress).toBe(false);
    expect(screw.surfaceStep).toBe(false);
  });

  it('keeps the optional screw step hidden initially and restores the Burgers vector outside motion', () => {
    const motion = displayOptionsForScene(defaultOptions, 'screw-glide');
    const model = displayOptionsForScene(motion, 'screw');
    expect(model.surfaceStep).toBe(false);
    expect(model.burgers).toBe(true);
    expect(model.trajectory).toBe(false);
  });

  it('defaults intersection trajectories on and stress arrows off', () => {
    const intersection = displayOptionsForScene(defaultOptions, 'edge-edge-perpendicular');
    expect(intersection.trajectory).toBe(true);
    expect(intersection.stress).toBe(false);
  });

  it('preserves a user-selected stress overlay across scenes that offer it', () => {
    const edge = displayOptionsForScene(defaultOptions, 'edge-glide');
    const screw = displayOptionsForScene({ ...edge, stress: true }, 'screw-glide');
    const frankRead = displayOptionsForScene(screw, 'frank-read');
    expect(screw.stress).toBe(true);
    expect(frankRead.stress).toBe(true);
    expect(displayOptionsForScene({ ...frankRead, stress: false }, 'edge-glide').stress).toBe(false);
  });

  it('preserves a user-selected surface step across screw scenes', () => {
    const model = displayOptionsForScene(defaultOptions, 'screw');
    const glide = displayOptionsForScene({ ...model, surfaceStep: true }, 'screw-glide');
    expect(glide.surfaceStep).toBe(true);
    expect(displayOptionsForScene({ ...glide, surfaceStep: false }, 'screw').surfaceStep).toBe(false);
  });

  it('aligns motion guidance with overlays that start hidden', () => {
    expect(sceneById['edge-glide'].stages[0]).toBe('滑移起始');
    expect(sceneById['cross-slip'].observe.some(text => text.includes('打开“伯氏矢量”'))).toBe(true);
    expect(sceneById.screw.observe.some(text => text.includes('打开“表面台阶”'))).toBe(true);
    expect(sceneById['screw-glide'].observe.some(text => text.includes('打开“表面台阶”'))).toBe(true);
  });
});
