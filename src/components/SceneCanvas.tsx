import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneId } from '../data/scenes';
import { DefectScene } from '../render/defectScene';
import type { DisplayOptions } from '../domain/modelTypes';

export interface SceneCanvasHandle { resetView: () => void }
interface Props { id: SceneId; progressRef: { current: number }; options: DisplayOptions; autoRotate: boolean; spacing: number }

export const SceneCanvas = memo(forwardRef<SceneCanvasHandle, Props>(function SceneCanvas({ id, progressRef, options, autoRotate, spacing }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<DefectScene | null>(null);
  const orbit = useRef<OrbitControls | null>(null);
  const props = useRef({ id, progressRef, options, autoRotate, spacing });
  const [error, setError] = useState(false);

  useImperativeHandle(ref, () => ({ resetView() { model.current?.resetCamera(); if (orbit.current) orbit.current.autoRotate = false; orbit.current?.target.set(0, 0, 0); orbit.current?.update(); } }), []);

  useEffect(() => { props.current = { id, progressRef, options, autoRotate, spacing }; }, [id, progressRef, options, autoRotate, spacing]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    element.appendChild(renderer.domElement);
    const visual = new DefectScene();
    model.current = visual;
    visual.update(props.current.id, props.current.progressRef.current, props.current.options, props.current.spacing);
    let lastModelId = props.current.id;
    let lastModelProgress = props.current.progressRef.current;
    let lastModelOptions = props.current.options;
    let lastModelSpacing = props.current.spacing;
    const controls = new OrbitControls(visual.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.minDistance = 4.1;
    controls.maxDistance = 18;
    controls.enablePan = true;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    orbit.current = controls;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      visual.camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      visual.camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const current = props.current;
      const nextProgress = current.progressRef.current;
      if (current.id !== lastModelId || nextProgress !== lastModelProgress || current.options !== lastModelOptions || current.spacing !== lastModelSpacing) {
        visual.update(current.id, nextProgress, current.options, current.spacing);
        lastModelId = current.id;
        lastModelProgress = nextProgress;
        lastModelOptions = current.options;
        lastModelSpacing = current.spacing;
      }
      controls.autoRotate = current.autoRotate;
      controls.autoRotateSpeed = 1.15;
      controls.update();
      renderer.render(visual.scene, visual.camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      visual.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      model.current = null;
      orbit.current = null;
    };
  }, []);

  return <div className="canvas-host" ref={host} aria-label="可旋转的三维位错模型">
    {error && <div className="canvas-error">无法启动三维视图。请检查浏览器的 WebGL 支持。</div>}
  </div>;
}));
