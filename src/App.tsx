import { useRef } from 'react';
import { modules } from './data/scenes';
import { SceneCanvas, type SceneCanvasHandle } from './components/SceneCanvas';
import { ModuleIcon, SceneIcon } from './components/LabIcons';
import type { DisplayOptions } from './domain/modelTypes';
import { frankReadLoopCount, intersectionConfig, type IntersectionId } from './domain/geometry';
import { useLabController } from './app/useLabController';
import { ArrowCounterClockwise, ArrowsClockwise, Pause, Play } from '@phosphor-icons/react';
import { extendedDissociationStart, extendedSpacingAdjustStart } from './domain/sceneGeometry';

const displayLabels: { key: keyof DisplayOptions; label: string }[] = [
  { key: 'atoms', label: '基体原子' }, { key: 'lattice', label: '晶格线' }, { key: 'line', label: '位错线' },
  { key: 'burgers', label: '伯氏矢量' }, { key: 'plane', label: '晶面' }, { key: 'trajectory', label: '运动轨迹' },
  { key: 'extraHalfPlane', label: '额外半原子面' }, { key: 'stress', label: '切应力' }, { key: 'surfaceStep', label: '表面台阶' },
];

export function App() {
  const lab = useLabController();
  const {
    sceneId, moduleId, scene, listedScenes, stage, progress, progressRef, playing, speed, spacing, options, autoRotate,
    setSpeed, setSpacing, setAutoRotate, pickScene, pickModule, toggleOption, reset, play, pause, step, seek,
  } = lab;
  const canvas = useRef<SceneCanvasHandle>(null);
  const intersection = moduleId === 'intersection' ? intersectionConfig(sceneId as IntersectionId) : null;
  const stressScene = sceneId === 'edge-glide' || sceneId === 'screw-glide' || sceneId === 'frank-read';
  const surfaceStepScene = sceneId === 'screw' || sceneId === 'screw-glide';
  const showsShearStress = stressScene && options.stress;
  const showsSurfaceStep = surfaceStepScene && options.surfaceStep;
  const formatVector = (vector: readonly number[]) => `[${vector.map(value => Number.isInteger(value) ? String(value) : value.toFixed(2)).join(' ')}]`;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo.png`} alt="" /></div>
        <div><h1>材科基 · 位错 3D 动态交互实验室</h1><span>畅研材料考研交流群：692990403</span></div>
      </div>
      <div className="top-actions">
        <button type="button" onClick={() => { setAutoRotate(false); canvas.current?.resetView(); }}><ArrowCounterClockwise aria-hidden="true" />重置视角</button>
        <button type="button" className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(value => !value)}><ArrowsClockwise aria-hidden="true" />自动旋转</button>
        {scene.animated && <button type="button" onClick={playing ? pause : play}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{moduleId === 'intersection' ? (playing ? '暂停交割' : '开始交割') : (playing ? '暂停动画' : '播放动画')}</button>}
      </div>
    </header>

    <main className="workspace">
      <aside className="left-rail" aria-label="场景选择与显示控制">
        <section className="panel module-panel">
          <div className="panel-header"><h2>功能模块</h2></div>
          <div className="module-nav" role="tablist" aria-label="位错模块">
            {modules.map(item => <button key={item.id} type="button" role="tab" aria-selected={moduleId === item.id} className={`module-tab ${moduleId === item.id ? 'selected' : ''}`} onClick={() => pickModule(item.id)}>
              <ModuleIcon id={item.id} /><span>{item.label}</span><span className="module-arrow">›</span>
            </button>)}
          </div>
        </section>
        <section className="panel scene-panel">
          <div className="panel-header"><h2>位错场景</h2></div>
          <div className="scene-list">{listedScenes.map(item => <button key={item.id} type="button" className={`scene-button ${sceneId === item.id ? 'selected' : ''}`} aria-current={sceneId === item.id ? 'true' : undefined} onClick={() => pickScene(item.id)}><SceneIcon /><span className="scene-name">{item.title}</span><span className="scene-chevron">→</span></button>)}</div>
        </section>
        <section className="panel display-panel">
          <div className="panel-header"><h2>模型显示</h2></div>
          <div className="display-grid">{displayLabels.filter(item =>
            (item.key !== 'extraHalfPlane' || ['edge', 'edge-glide', 'edge-climb'].includes(sceneId)) &&
            (item.key !== 'trajectory' || moduleId === 'motion' || moduleId === 'intersection') &&
            (item.key !== 'lattice' || moduleId !== 'partial') &&
            (item.key !== 'stress' || stressScene) &&
            (item.key !== 'surfaceStep' || surfaceStepScene)
          ).map(item => <label key={item.key} className={`display-toggle ${options[item.key] ? 'on' : ''}`}><input type="checkbox" checked={options[item.key]} onChange={() => toggleOption(item.key)} /><span className="toggle-track" /><span>{item.label}</span></label>)}</div>
        </section>
      </aside>

      <section className="stage panel" aria-label="三维位错场景">
        <div className="stage-header"><div className="stage-heading"><img className="stage-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" /><h2>{scene.title}</h2></div><span className="stage-pill">3D 可交互</span></div>
        <div className="stage-subtitle"><span className="stage-category">{modules.find(item => item.id === moduleId)?.label}</span><p>{scene.subtitle}</p></div>
        <SceneCanvas ref={canvas} id={sceneId} progressRef={progressRef} options={options} autoRotate={autoRotate} spacing={spacing} />
        <div className="scene-legend"><span><i className="legend-dot orange" />位错线 L₁</span>{(moduleId === 'intersection' || (moduleId === 'partial' && sceneId !== 'frank' && (sceneId !== 'extended' || progress > extendedDissociationStart))) && <span><i className="legend-dot blue" />位错线 L₂</span>}<span><i className="legend-dot pale" />{moduleId === 'partial' ? '层错面' : '滑移面'}</span>{moduleId === 'intersection' && progress > .45 && options.line && <span><i className="legend-dot intersection" />交割点</span>}{(moduleId === 'motion' || moduleId === 'intersection') && options.trajectory && <span><i className={`legend-dot ${moduleId === 'intersection' ? 'intersection-traj' : 'motion'}`} />{moduleId === 'intersection' ? '两线接近轨迹' : '运动路径与方向'}</span>}{showsShearStress && <span><i className="legend-dot stress" />τ 外加切应力</span>}{showsSurfaceStep && <span><i className="legend-dot surface-step" />表面台阶/滑移分界</span>}</div>
        <div className="stage-footnote">拖动旋转 · 滚轮缩放 · 中键/右键平移<span>模型为教学几何示意，非原子级物理仿真</span></div>
      </section>

      <aside className="right-rail" aria-label="教学说明">
        <section className="panel info-panel">
          <div className="panel-header"><h2>当前信息</h2></div>
          <dl className="info-grid">
            <dt>当前场景</dt><dd>{scene.title}</dd>
            <dt>空间关系</dt><dd>{scene.relation}</dd>
            <dt>过程阶段</dt><dd>{stage}</dd>
          </dl>
          {intersection && <div className="vector-grid"><span>b₁ {formatVector(intersection.b1)}</span><span>b₂ {formatVector(intersection.b2)}</span><span>L₁ {formatVector(intersection.l1)}</span><span>L₂ {formatVector(intersection.l2)}</span></div>}
        </section>
        <section className="panel teaching-panel">
          <div className="panel-header"><h2>教学解析</h2></div>
          <div className="teaching-content">
            <p className="teaching-intro">{scene.subtitle}</p>
            <section className="observe"><span className="mini-label">请观察</span><ol>{scene.observe.map(item => <li key={item}>{item}</li>)}</ol></section>
            <div className="takeaway"><span className="mini-label">核心结论</span><p>{scene.result}</p></div>
            {scene.caution && <div className="caution">科学验收提示：{scene.caution}</div>}
          </div>
        </section>
      </aside>
    </main>

    <footer className="timeline panel">
      <div className="timeline-left"><span className="timeline-overline">ANIMATION CONTROL</span><strong>{sceneId === 'frank-read' && progress >= 1 ? `第 ${Math.floor(progress) + 1} 轮 · ${stage}` : scene.animated ? stage : '旋转模型，观察空间结构'}</strong>{sceneId === 'frank-read' && <small>累计生成 {frankReadLoopCount(progress)} 个环</small>}</div>
      <div className="player">
        <button type="button" className="primary-control" onClick={playing ? pause : play} disabled={!scene.animated} aria-label={moduleId === 'intersection' ? (playing ? '暂停交割' : '开始交割') : (playing ? '暂停动画' : '播放动画')}>{playing ? 'Ⅱ' : '▶'}</button>
        {moduleId === 'intersection' ? <button type="button" className="before-control" onClick={reset} disabled={!scene.animated} aria-label="交割前并重置动画">交割前／重置</button> : <button type="button" onClick={reset} disabled={!scene.animated} aria-label="重置动画">↶</button>}
        <button type="button" onClick={step} disabled={!scene.animated} aria-label="单步前进">↦</button>
      </div>
      <div className="timeline-progress"><input type="range" min="0" max="1000" value={Math.round((sceneId === 'frank-read' ? progress % 1 : progress) * 1000)} onChange={event => seek(Number(event.target.value) / 1000)} disabled={!scene.animated} aria-label="动画进度" /><span>{Math.round((sceneId === 'frank-read' ? progress % 1 : progress) * 100)}%</span></div>
      <div className="speed-controls"><span>速度</span><button type="button" className={speed === .5 ? 'active' : ''} onClick={() => setSpeed(.5)}>0.5×</button><button type="button" className={speed === 1 ? 'active' : ''} onClick={() => setSpeed(1)}>1×</button></div>
      {sceneId === 'extended' && <div className="spacing-control">
        <label htmlFor="partial-spacing">不全位错间距</label>
        <input id="partial-spacing" type="range" min="0.7" max="3" step="0.05" value={spacing} disabled={progress < extendedSpacingAdjustStart} aria-describedby="spacing-hint" onChange={event => setSpacing(Number(event.target.value))} />
        <small id="spacing-hint">{progress < extendedSpacingAdjustStart ? '两条部分位错形成后可调' : '调节两条位错与层错带宽度'}</small>
      </div>}
    </footer>
  </div>;
}
