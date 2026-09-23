import type { SceneInfo } from '../data/scenes';

export function playbackDurationMs(scene: SceneInfo) {
  return scene.id === 'frank-read' ? 9800 : 7100;
}

export function stageIndexAt(scene: SceneInfo, progress: number) {
  if (scene.stageThresholds) {
    return scene.stageThresholds.reduce((index, threshold) => index + (progress >= threshold ? 1 : 0), 0);
  }
  return Math.min(scene.stages.length - 1, Math.floor(Math.max(0, progress) * scene.stages.length));
}

export function stageAt(scene: SceneInfo, progress: number) {
  return scene.stages[stageIndexAt(scene, progress)];
}

export function stepProgress(scene: SceneInfo, progress: number) {
  const cycle = scene.id === 'frank-read' ? Math.floor(progress) : 0;
  const local = scene.id === 'frank-read' ? progress - cycle : progress;
  const boundaries = scene.stageThresholds ?? scene.stages.slice(1).map((_, index) => (index + 1) / scene.stages.length);
  const next = boundaries.find(boundary => boundary > local + 1e-6) ?? 1;
  return cycle + next;
}

export function seekProgress(scene: SceneInfo, current: number, value: number) {
  return scene.id === 'frank-read' ? Math.floor(current) + value : value;
}
