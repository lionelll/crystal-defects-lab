import { useEffect, useMemo, useRef, useState } from 'react';
import { sceneById, scenes, type ModuleId, type SceneId } from '../data/scenes';
import type { DisplayOptions } from '../domain/modelTypes';
import { playbackDurationMs, seekProgress, stageAt, stepProgress } from './playback';

export const defaultOptions: DisplayOptions = { atoms: true, lattice: false, line: true, burgers: true, plane: true, trajectory: false, extraHalfPlane: true, stress: false, surfaceStep: false };
const surfaceStepInitial: Partial<Record<SceneId, boolean>> = { screw: true, 'screw-glide': false };

export function displayOptionsForScene(current: DisplayOptions, id: SceneId, surfaceStepByScene: Partial<Record<SceneId, boolean>> = {}): DisplayOptions {
  const module = sceneById[id].module;
  return {
    ...current,
    burgers: module !== 'motion',
    trajectory: module === 'motion' || module === 'intersection',
    surfaceStep: surfaceStepByScene[id] ?? surfaceStepInitial[id] ?? current.surfaceStep,
  };
}

export function useLabController() {
  const [sceneId, setSceneId] = useState<SceneId>('edge');
  const [moduleId, setModuleId] = useState<ModuleId>('model');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [spacing, setSpacing] = useState(1.7);
  const [options, setOptions] = useState<DisplayOptions>(defaultOptions);
  const [surfaceStepByScene, setSurfaceStepByScene] = useState<Partial<Record<SceneId, boolean>>>({});
  const [autoRotate, setAutoRotate] = useState(false);
  const lastTime = useRef(0);
  const lastUiTime = useRef(0);
  const progressRef = useRef(0);
  const scene = sceneById[sceneId];
  const listedScenes = useMemo(() => scenes.filter(item => item.module === moduleId), [moduleId]);
  const currentCycleProgress = sceneId === 'frank-read' ? progress % 1 : progress;
  const stage = stageAt(scene, currentCycleProgress);

  useEffect(() => {
    if (!playing || !scene.animated) return;
    let frame = 0;
    lastTime.current = 0;
    lastUiTime.current = 0;
    const tick = (time: number) => {
      if (lastTime.current) {
        const dt = Math.min(50, time - lastTime.current);
        const next = progressRef.current + dt / playbackDurationMs(scene) * speed;
        const finished = scene.id !== 'frank-read' && next >= 1;
        progressRef.current = finished ? 1 : next;
        if (finished || time - lastUiTime.current >= 50) {
          lastUiTime.current = time;
          setProgress(progressRef.current);
        }
        if (finished) { setPlaying(false); return; }
      }
      lastTime.current = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, scene, speed]);

  const pickScene = (id: SceneId) => {
    setSceneId(id);
    setModuleId(sceneById[id].module);
    progressRef.current = 0;
    setProgress(0);
    setPlaying(false);
    setSpacing(1.7);
    setOptions(current => displayOptionsForScene(current, id, surfaceStepByScene));
  };
  const pickModule = (id: ModuleId) => {
    const first = scenes.find(item => item.module === id);
    if (first) pickScene(first.id);
  };
  const toggleOption = (key: keyof DisplayOptions) => {
    if (key === 'surfaceStep') {
      const next = !options.surfaceStep;
      setSurfaceStepByScene(current => ({ ...current, [sceneId]: next }));
      setOptions(current => ({ ...current, surfaceStep: next }));
      return;
    }
    setOptions(current => ({ ...current, [key]: !current[key] }));
  };
  const reset = () => { setPlaying(false); progressRef.current = 0; setProgress(0); };
  const play = () => { if (!scene.animated) return; if (scene.id !== 'frank-read' && progressRef.current >= 1) { progressRef.current = 0; setProgress(0); } setPlaying(true); };
  const pause = () => { setPlaying(false); setProgress(progressRef.current); };
  const step = () => { setPlaying(false); progressRef.current = stepProgress(scene, progressRef.current); setProgress(progressRef.current); };
  const seek = (value: number) => {
    setPlaying(false);
    const next = seekProgress(scene, progressRef.current, value);
    progressRef.current = next;
    setProgress(next);
  };

  return {
    sceneId, moduleId, scene, listedScenes, stage, progress, progressRef, playing, speed, spacing, options, autoRotate,
    setSpeed, setSpacing, setAutoRotate, pickScene, pickModule, toggleOption, reset, play, pause, step, seek,
  };
}
