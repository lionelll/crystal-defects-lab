import * as THREE from 'three';
import type { SceneId } from '../data/scenes';
import { frankReadState, type IntersectionId, type Vec3 } from '../domain/geometry';
import type { DisplayOptions } from '../domain/modelTypes';
import { cubicAtomPosition, doubleCrossSlipParallelPlaneY, doubleCrossSlipPlaneX, doubleCrossSlipState, edgeState, extendedDissociationStart, fccAtomPosition, frankFaultAtomPosition, fullFccBurgersLocal, intersectionFrame, leadingShockleyLocal, partialSeparation, screwPitch, screwState, secondCrossSlipPlaneX, smoothRange, trailingShockleyLocal, vacancyLatticeIndex } from '../domain/sceneGeometry';

const ink = 0x173252;
const atomBlue = 0x5a9bd1;
const lineOrange = 0xf28a31;
const lineBlue = 0x1588ff;
const planeBlue = 0x62a9e8;
const faultYellow = 0xf2ba58;
const motionGuide = 0x80e3c4;
const stressViolet = 0xc597ff;
const surfaceStepGold = 0xf5c573;
const temp = new THREE.Object3D();
const atomDefaultColor = new THREE.Color(atomBlue);
const atomFaultColor = new THREE.Color(faultYellow);
const atomMiddleLayerColor = new THREE.Color(0x5599ca);
const atomEdgeHighlightColor = new THREE.Color(0x76aace);
const atomScrewHighlightColor = new THREE.Color(0x82bed0);

function clamp(t: number) { return Math.max(0, Math.min(1, t)); }
const range = smoothRange;
function V(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z); }
function fromTuple(v: Vec3) { return V(v[0], v[1], v[2]); }

function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    // ArrowHelper shares its shaft/head geometry across instances in Three.js.
    if (!(object.parent instanceof THREE.ArrowHelper)) mesh.geometry?.dispose();
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    materials.forEach(material => material.dispose());
  });
}

function disposeGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function addLine(group: THREE.Group, points: THREE.Vector3[], color: number, radius = 0.055, opacity = 1) {
  if (points.length < 2) return;
  if (group instanceof DynamicDrawPool) { group.drawTube(points, color, radius, opacity, false); return; }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, Math.max(16, points.length * 3), radius, 8, false);
  const material = new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .1, transparent: opacity < 1, opacity });
  group.add(new THREE.Mesh(geometry, material));
}

function addSegmentedLine(group: THREE.Group, points: THREE.Vector3[], color: number, radius = .055) {
  if (points.length < 2) return;
  if (group instanceof DynamicDrawPool) { group.drawTube(points, color, radius, 1, true); return; }
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 1; index < points.length; index++) path.add(new THREE.LineCurve3(points[index - 1], points[index]));
  group.add(new THREE.Mesh(
    new THREE.TubeGeometry(path, Math.max(48, points.length * 8), radius, 8, false),
    new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .1 }),
  ));
}

function addSphere(group: THREE.Group, position: THREE.Vector3, radius: number, color: number, opacity = 1) {
  if (group instanceof DynamicDrawPool) { group.drawSphere(position, radius, color, opacity); return; }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: .42, transparent: opacity < 1, opacity }));
  mesh.position.copy(position);
  group.add(mesh);
}

function addPlane(group: THREE.Group, center: THREE.Vector3, normal: THREE.Vector3, width: number, height: number, color = planeBlue, opacity = .17) {
  if (group instanceof DynamicDrawPool) { group.drawPlane(center, normal, width, height, color, opacity); return; }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false }));
  mesh.quaternion.setFromUnitVectors(V(0, 0, 1), normal.clone().normalize());
  mesh.position.copy(center);
  group.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .5 }));
  edges.quaternion.copy(mesh.quaternion);
  edges.position.copy(center);
  group.add(edges);
}

function addArrow(group: THREE.Group, start: THREE.Vector3, vector: THREE.Vector3, color: number, scale = 1) {
  if (group instanceof DynamicDrawPool) { group.drawArrow(start, vector, color, scale); return; }
  const direction = vector.clone().normalize();
  const arrow = new THREE.ArrowHelper(direction, start, vector.length() * scale, color, .22, .14);
  group.add(arrow);
}

function addShearArrow(group: THREE.Group, start: THREE.Vector3, vector: THREE.Vector3) {
  addLine(group, [start, start.clone().add(vector)], stressViolet, .026, .9);
  addArrow(group, start, vector, stressViolet);
}

function addLoop(group: THREE.Group, center: THREE.Vector3, radius: number, color: number, plane: 'xy' | 'xz' | 'yz' = 'xy', opacity = 1) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = 2 * Math.PI * i / 64;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    points.push(plane === 'xy' ? V(center.x + c, center.y + s, center.z) : plane === 'xz' ? V(center.x + c, center.y, center.z + s) : V(center.x, center.y + c, center.z + s));
  }
  addLine(group, points, color, .055, opacity);
}

function makeHelicoidGeometry(coreX: number, coreY: number, baseZ: number, pitch: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const radialSteps = 9, angularSteps = 56;
  for (let a = 0; a <= angularSteps; a++) {
    const theta = -Math.PI + 2 * Math.PI * a / angularSteps;
    for (let r = 0; r <= radialSteps; r++) {
      const radius = .18 + 2.15 * r / radialSteps;
      vertices.push(coreX + radius * Math.cos(theta), coreY + radius * Math.sin(theta), baseZ + pitch * theta / (2 * Math.PI));
      if (a < angularSteps && r < radialSteps) {
        const i = a * (radialSteps + 1) + r;
        indices.push(i, i + 1, i + radialSteps + 1, i + 1, i + radialSteps + 2, i + radialSteps + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addHelicoid(group: THREE.Group, coreX: number, coreY: number, baseZ: number, pitch: number) {
  if (group instanceof DynamicDrawPool) { group.drawHelicoid(coreX, coreY, baseZ, pitch); return; }
  group.add(new THREE.Mesh(makeHelicoidGeometry(coreX, coreY, baseZ, pitch), new THREE.MeshBasicMaterial({ color: 0x6da7d2, side: THREE.DoubleSide, transparent: true, opacity: .12, depthWrite: false })));
}

function addLatticeFrame(group: THREE.Group) {
  const material = new THREE.LineBasicMaterial({ color: 0x9cb6d1, transparent: true, opacity: .33 });
  for (let y = -1.5; y <= 1.5; y += 1.5) {
    for (let z = -1.5; z <= 1.5; z += 1.5) {
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-2.55, y, z), V(2.55, y, z)]), material));
    }
  }
  for (let x = -2.5; x <= 2.5; x += 1.25) {
    for (let z = -1.5; z <= 1.5; z += 1.5) {
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(x, -1.55, z), V(x, 1.55, z)]), material));
    }
  }
}

type DrawSlot = { kind: string; holder: THREE.Group; coordinates?: number[]; radius?: number; segments?: number; params?: number[] };

/** Reuse GPU meshes and buffers while the playhead changes. Geometry is rebuilt
 * on the CPU only when a tube's control points actually move. */
class DynamicDrawPool extends THREE.Group {
  private slots: DrawSlot[] = [];
  private cursor = 0;

  beginFrame() { this.cursor = 0; }
  endFrame() { for (let index = this.cursor; index < this.slots.length; index++) this.slots[index].holder.visible = false; }

  private use(kind: string, create: () => THREE.Group): DrawSlot {
    const index = this.cursor++;
    const previous = this.slots[index];
    if (previous && previous.kind !== kind) {
      this.remove(previous.holder);
      disposeObject(previous.holder);
    }
    if (!previous || previous.kind !== kind) {
      const holder = create();
      this.add(holder);
      this.slots[index] = { kind, holder };
    }
    const slot = this.slots[index];
    slot.holder.visible = true;
    return slot;
  }

  drawTube(points: THREE.Vector3[], color: number, radius: number, opacity: number, segmented: boolean) {
    const kind = segmented ? 'segmented-tube' : 'tube';
    const segments = segmented ? 64 : points.length >= 32 ? 96 : 32;
    const makeGeometry = () => {
      const curve = segmented ? new THREE.CurvePath<THREE.Vector3>() : new THREE.CatmullRomCurve3(points, false, 'centripetal');
      if (segmented) for (let index = 1; index < points.length; index++) (curve as THREE.CurvePath<THREE.Vector3>).add(new THREE.LineCurve3(points[index - 1], points[index]));
      return new THREE.TubeGeometry(curve, segments, radius, 8, false);
    };
    const slot = this.use(kind, () => {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(makeGeometry(), new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .1, transparent: true, opacity })));
      return holder;
    });
    const mesh = slot.holder.children[0] as THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
    const material = mesh.material;
    material.color.setHex(color);
    material.opacity = opacity;
    const coordinates = points.flatMap(point => [point.x, point.y, point.z]);
    const topologyChanged = slot.segments !== undefined && slot.segments !== segments;
    const moved = topologyChanged || slot.radius !== radius || !slot.coordinates || coordinates.length !== slot.coordinates.length || coordinates.some((value, index) => value !== slot.coordinates![index]);
    if (moved && slot.coordinates) {
      const next = makeGeometry();
      if (topologyChanged) {
        mesh.geometry.dispose();
        mesh.geometry = next;
      } else {
        for (const name of ['position', 'normal'] as const) {
          const target = mesh.geometry.getAttribute(name) as THREE.BufferAttribute;
          const source = next.getAttribute(name) as THREE.BufferAttribute;
          (target.array as Float32Array).set(source.array as Float32Array);
          target.needsUpdate = true;
        }
        mesh.geometry.computeBoundingSphere();
        next.dispose();
      }
    }
    slot.coordinates = coordinates;
    slot.radius = radius;
    slot.segments = segments;
  }

  drawSphere(position: THREE.Vector3, radius: number, color: number, opacity: number) {
    const slot = this.use('sphere', () => {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: .42, transparent: true, opacity })));
      return holder;
    });
    slot.holder.position.copy(position);
    slot.holder.scale.setScalar(radius);
    const material = (slot.holder.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>).material;
    material.color.setHex(color);
    material.opacity = opacity;
  }

  drawPlane(center: THREE.Vector3, normal: THREE.Vector3, width: number, height: number, color: number, opacity: number) {
    const slot = this.use('plane', () => {
      const holder = new THREE.Group();
      const geometry = new THREE.PlaneGeometry(1, 1);
      holder.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false })));
      holder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .5 })));
      return holder;
    });
    slot.holder.position.copy(center);
    slot.holder.quaternion.setFromUnitVectors(V(0, 0, 1), normal.clone().normalize());
    slot.holder.scale.set(width, height, 1);
    const surface = (slot.holder.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material;
    const edge = (slot.holder.children[1] as THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>).material;
    surface.color.setHex(color);
    surface.opacity = opacity;
    edge.color.setHex(color);
  }

  drawArrow(start: THREE.Vector3, vector: THREE.Vector3, color: number, scale: number) {
    const slot = this.use('arrow', () => {
      const holder = new THREE.Group();
      holder.add(new THREE.ArrowHelper(vector.clone().normalize(), V(0, 0, 0), vector.length() * scale, color, .22, .14));
      return holder;
    });
    slot.holder.position.copy(start);
    const arrow = slot.holder.children[0] as THREE.ArrowHelper;
    arrow.setDirection(vector.clone().normalize());
    arrow.setLength(vector.length() * scale, .22, .14);
    arrow.setColor(color);
  }

  drawHelicoid(coreX: number, coreY: number, baseZ: number, pitch: number) {
    const slot = this.use('helicoid', () => {
      const holder = new THREE.Group();
      addHelicoid(holder, coreX, coreY, baseZ, pitch);
      return holder;
    });
    const params = [coreX, coreY, baseZ, pitch];
    if (slot.params && params.some((value, index) => value !== slot.params![index])) {
      const mesh = slot.holder.children[0] as THREE.Mesh<THREE.BufferGeometry>;
      mesh.geometry.dispose();
      mesh.geometry = makeHelicoidGeometry(coreX, coreY, baseZ, pitch);
    }
    slot.params = params;
  }

  disposePool() { disposeGroup(this); this.slots = []; this.cursor = 0; }
}

export class DefectScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  private staticLayer = new THREE.Group();
  private dynamicLayer = new DynamicDrawPool();
  private atoms: THREE.InstancedMesh | null = null;
  private extra: THREE.InstancedMesh | null = null;
  private latticeObjects: THREE.Object3D[] = [];
  private id: SceneId = 'edge';
  private settings: DisplayOptions | null = null;

  constructor() {
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd8e6, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(4, 7, 8); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9d6f2, .75); fill.position.set(-5, 1, -4); this.scene.add(fill);
    this.scene.add(this.staticLayer, this.dynamicLayer);
    this.resetCamera();
  }

  resetCamera() { this.camera.position.set(6.7, 5.2, 7.2); this.camera.lookAt(0, 0, 0); }

  setScene(id: SceneId, settings: DisplayOptions) {
    const previous = this.settings;
    const sceneChanged = !previous || id !== this.id;
    if (sceneChanged) {
      disposeGroup(this.staticLayer);
      this.atoms = null;
      this.extra = null;
      this.latticeObjects = [];
    }
    this.id = id;
    const partial = ['extended', 'shockley', 'frank'].includes(id);
    if (sceneChanged || settings.atoms !== previous.atoms) {
      if (this.atoms) { this.staticLayer.remove(this.atoms); disposeObject(this.atoms); this.atoms = null; }
      if (settings.atoms) {
        const count = partial ? 5 * 7 * 7 : 7 * 5 * 5;
        const geometry = new THREE.SphereGeometry(partial ? .092 : .095, 10, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .08, transparent: true, opacity: ['frank-read', 'double-cross-slip'].includes(id) ? .28 : id.includes('edge-') && id.includes('perpendicular') ? .46 : .87 });
        this.atoms = new THREE.InstancedMesh(geometry, material, count);
        this.atoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.staticLayer.add(this.atoms);
      }
    }
    if (sceneChanged || settings.extraHalfPlane !== previous.extraHalfPlane) {
      if (this.extra) { this.staticLayer.remove(this.extra); disposeObject(this.extra); this.extra = null; }
      if (settings.extraHalfPlane && !partial && ['edge', 'edge-glide', 'edge-climb'].includes(id)) {
        this.extra = new THREE.InstancedMesh(new THREE.SphereGeometry(.095, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf39a64, roughness: .4 }), 2 * 5);
        this.extra.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.staticLayer.add(this.extra);
      }
    }
    if (sceneChanged || settings.lattice !== previous.lattice) {
      for (const object of this.latticeObjects) { this.staticLayer.remove(object); disposeObject(object); }
      this.latticeObjects = [];
      if (settings.lattice && !partial) {
        const first = this.staticLayer.children.length;
        addLatticeFrame(this.staticLayer);
        this.latticeObjects = this.staticLayer.children.slice(first);
      }
    }
    this.settings = settings;
  }

  update(id: SceneId, progress: number, settings: DisplayOptions, spacing = 1.7) {
    const staticChanged = id !== this.id || !this.settings || settings.atoms !== this.settings.atoms || settings.lattice !== this.settings.lattice || settings.extraHalfPlane !== this.settings.extraHalfPlane;
    if (staticChanged) this.setScene(id, settings);
    else this.settings = settings;
    const p = id === 'frank-read' ? Math.max(0, progress) : clamp(progress);
    this.updateAtoms(id, p, spacing);
    this.dynamicLayer.beginFrame();
    if (id === 'edge' || id === 'edge-glide' || id === 'edge-climb') this.drawEdge(id, p, settings);
    else if (id === 'screw' || id === 'screw-glide' || id === 'cross-slip') this.drawScrew(id, p, settings);
    else if (id === 'frank-read') this.drawFrankRead(p, settings);
    else if (id === 'double-cross-slip') this.drawDoubleCrossSlip(p, settings);
    else if (id === 'extended' || id === 'shockley' || id === 'frank') this.drawPartial(id, p, settings, spacing);
    else this.drawIntersection(id, p, settings);
    this.dynamicLayer.endFrame();
  }

  private updateAtoms(id: SceneId, p: number, spacing: number) {
    const partial = ['extended', 'shockley', 'frank'].includes(id);
    const screw = ['screw', 'screw-glide', 'cross-slip'].includes(id);
    const edge = ['edge', 'edge-glide', 'edge-climb'].includes(id);
    const core = edge ? edgeState(id, p) : screwState(id, p);
    const atoms = this.atoms;
    if (atoms) {
      let index = 0;
      if (partial) {
        const d = partialSeparation(id, p, spacing);
        for (let layer = -2; layer <= 2; layer++) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
          const { position, inFault, missing } = id === 'frank'
            ? frankFaultAtomPosition(i, j, layer)
            : { ...fccAtomPosition(i, j, layer, d), missing: false };
          temp.position.set(...position);
          temp.scale.setScalar(missing ? 0 : 1); temp.updateMatrix(); atoms.setMatrixAt(index, temp.matrix);
          atoms.setColorAt(index, inFault ? atomFaultColor : layer === 0 ? atomMiddleLayerColor : atomDefaultColor);
          index++;
        }
      } else {
        for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
          const [x, y, z] = cubicAtomPosition(id, p, i, j, k);
          temp.position.set(x, y, z);
          const vacancyI = vacancyLatticeIndex(p);
          temp.scale.setScalar(id === 'edge-climb' && j === 1 && k === 0 && i === vacancyI ? 0 : 1);
          temp.updateMatrix(); atoms.setMatrixAt(index, temp.matrix);
          atoms.setColorAt(index, edge && j > 0 && Math.abs(i) < 2 ? atomEdgeHighlightColor : screw && y > 0 && x > core.x ? atomScrewHighlightColor : atomDefaultColor);
          index++;
        }
      }
      atoms.instanceMatrix.needsUpdate = true;
      if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
    }
    if (this.extra) {
      for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) {
        temp.position.set(core.x, .48 + j * .74 + core.y, (k - 2) * .75); temp.scale.setScalar(1); temp.updateMatrix(); this.extra.setMatrixAt(k * 2 + j, temp.matrix);
      }
      this.extra.instanceMatrix.needsUpdate = true;
    }
  }

  private drawEdge(id: SceneId, p: number, s: DisplayOptions) {
    const { x, y } = edgeState(id, p);
    if (s.plane) {
      addPlane(this.dynamicLayer, V(0, 0, 0), V(0, 1, 0), 5.4, 3.7);
    }
    if (s.extraHalfPlane) {
      addPlane(this.dynamicLayer, V(x, 1.05 + y, 0), V(1, 0, 0), 3.6, 2.15, 0xf19b73, .12);
    }
    if (s.line) addLine(this.dynamicLayer, [V(x, y, -1.9), V(x, y, 1.9)], lineOrange, .077);
    if (s.burgers) { addArrow(this.dynamicLayer, V(x + .15, y + .13, 1.93), V(.85, 0, 0), lineBlue); addArrow(this.dynamicLayer, V(x - .2, y, -2.12), V(0, 0, 1), ink, .85); }
    if (id === 'edge-glide' && s.stress) {
      addShearArrow(this.dynamicLayer, V(-1.95, 1.7, -2.1), V(.68, 0, 0));
      addShearArrow(this.dynamicLayer, V(1.95, -1.7, -2.1), V(-.68, 0, 0));
    }
    if (id === 'edge-climb') {
      const site = vacancyLatticeIndex(p);
      if (site !== null) {
        const absorption = range(p, .52, .66);
        const vac = V(site * .75, .75, 0).lerp(V(x, .48 + y, 0), absorption);
        const radius = .16 * (1 - absorption);
        if (radius > .005) addLoop(this.dynamicLayer, vac, radius, 0xe59a45, 'xy', .9);
      }
      if (p >= .52 && p < .72) addSphere(this.dynamicLayer, V(x, .48 + y, 0), .1 + .07 * Math.sin(Math.PI * range(p, .52, .72)), 0xffd47e, .65);
    }
    if (s.trajectory && id === 'edge-glide') {
      addLine(this.dynamicLayer, [V(-1.45, -.12, -2.15), V(1.45, -.12, -2.15)], motionGuide, .026, .95);
      addArrow(this.dynamicLayer, V(1.1, -.12, -2.15), V(.38, 0, 0), motionGuide, .75);
    }
    if (s.trajectory && id === 'edge-climb') {
      addLine(this.dynamicLayer, [V(.2, 0, -2.1), V(.2, 1.15, -2.1)], motionGuide, .026, .95);
      addArrow(this.dynamicLayer, V(.2, .82, -2.1), V(0, .36, 0), motionGuide, .75);
    }
  }

  private drawScrew(id: SceneId, p: number, s: DisplayOptions) {
    const { x, y } = screwState(id, p);
    if (s.plane) {
      if (id === 'screw') addHelicoid(this.dynamicLayer, x, y, -.65, screwPitch);
      else addPlane(this.dynamicLayer, V(0, 0, 0), V(0, 1, 0), 5.2, 3.8, planeBlue, .13);
      if (id === 'cross-slip') addPlane(this.dynamicLayer, V(secondCrossSlipPlaneX, 0, 0), V(1, 0, 0), 3.8, 3.2, 0x7ec3a8, .13);
    }
    if ((id === 'screw' || id === 'screw-glide') && s.surfaceStep) {
      addHelicoid(this.dynamicLayer, x, y, 1.45, screwPitch);
      addPlane(this.dynamicLayer, V(x - 1.12, y, 1.45), V(0, 1, 0), 2.1, screwPitch, surfaceStepGold, .13);
      addLine(this.dynamicLayer, [V(x - 2.17, y - .018, 1.45 - screwPitch / 2), V(x - .18, y - .018, 1.45 - screwPitch / 2)], surfaceStepGold, .038);
      addLine(this.dynamicLayer, [V(x - 2.17, y + .018, 1.45 + screwPitch / 2), V(x - .18, y + .018, 1.45 + screwPitch / 2)], surfaceStepGold, .038);
      addLine(this.dynamicLayer, [V(x - 2.17, y, 1.45 - screwPitch / 2), V(x - 2.17, y, 1.45 + screwPitch / 2)], surfaceStepGold, .028);
    }
    if (s.line) addLine(this.dynamicLayer, [V(x, y, -2), V(x, y, 2)], lineOrange, .078);
    if (s.burgers) { addArrow(this.dynamicLayer, V(x + .3, y + .2, -1), V(0, 0, 1), lineBlue, .85); addArrow(this.dynamicLayer, V(x - .28, y, -1.8), V(0, 0, 1), ink, .6); }
    if (id === 'screw-glide' && s.stress) {
      addShearArrow(this.dynamicLayer, V(-2.1, 1.7, -.95), V(0, 0, .7));
      addShearArrow(this.dynamicLayer, V(2.1, -1.7, .95), V(0, 0, -.7));
    }
    if (s.trajectory && id === 'screw-glide') {
      addLine(this.dynamicLayer, [V(-1.25, 0, -2.18), V(1.25, 0, -2.18)], motionGuide, .026, .95);
      addArrow(this.dynamicLayer, V(.9, 0, -2.18), V(.38, 0, 0), motionGuide, .75);
    }
    if (s.trajectory && id === 'cross-slip') {
      addLine(this.dynamicLayer, [V(0, 0, -2.18), V(secondCrossSlipPlaneX, 0, -2.18), V(secondCrossSlipPlaneX, 1.1, -2.18)], motionGuide, .026, .95);
      addArrow(this.dynamicLayer, V(.85, 0, -2.18), V(.38, 0, 0), motionGuide, .75);
      addArrow(this.dynamicLayer, V(secondCrossSlipPlaneX, .73, -2.18), V(0, .38, 0), motionGuide, .75);
    }
  }

  private drawFrankRead(p: number, s: DisplayOptions) {
    if (s.plane) addPlane(this.dynamicLayer, V(0, 0, 0), V(0, 0, 1), 5.8, 5, planeBlue, .14);
    const a = V(-2, 0, 0), b = V(2, 0, 0);
    addSphere(this.dynamicLayer, a, .17, 0x425a72); addSphere(this.dynamicLayer, b, .17, 0x425a72);
    if (s.line) {
      const state = frankReadState(p);
      addLine(this.dynamicLayer, state.source.map(fromTuple), lineOrange, .07);
      state.loops.forEach((loop, index) => addLoop(this.dynamicLayer, fromTuple(loop.center), loop.radius, index === 0 ? 0xe9a047 : 0xf1bb65, 'xy', loop.opacity));
    }
    if (s.burgers) addArrow(this.dynamicLayer, V(-2.35, -.42, 0), V(0, .95, 0), lineBlue);
    if (s.stress) {
      addShearArrow(this.dynamicLayer, V(-2.55, -.5, .65), V(0, .72, 0));
      addShearArrow(this.dynamicLayer, V(2.55, .5, -.65), V(0, -.72, 0));
    }
  }

  private drawDoubleCrossSlip(p: number, s: DisplayOptions) {
    if (s.plane) {
      addPlane(this.dynamicLayer, V(0, 0, 0), V(0, 1, 0), 5.1, 4.1, planeBlue, .13);
      addPlane(this.dynamicLayer, V(doubleCrossSlipPlaneX, 0, 0), V(1, 0, 0), 4.1, 4.1, 0x70bbaa, .12);
      addPlane(this.dynamicLayer, V(0, doubleCrossSlipParallelPlaneY, 0), V(0, 1, 0), 5.1, 4.1, faultYellow, .09);
    }
    addSphere(this.dynamicLayer, V(-.55, 0, 0), .22, 0x7a8799);
    const state = doubleCrossSlipState(p);
    if (s.line) addSegmentedLine(this.dynamicLayer, state.line.map(fromTuple), lineOrange, .07);
    if (s.line && state.connectedArc) addLine(this.dynamicLayer, state.connectedArc.map(fromTuple), lineOrange, .055);
    if (s.line && state.loopRadius !== null) addLoop(this.dynamicLayer, fromTuple(state.loopCenter), state.loopRadius, lineOrange, 'xz');
    if (s.burgers) addArrow(this.dynamicLayer, V(-1.8, .3, -1.8), V(0, 0, 1), lineBlue);
  }

  private drawIntersection(id: SceneId, p: number, s: DisplayOptions) {
    const frame = intersectionFrame(id as IntersectionId, p);
    const { config } = frame;
    const center1 = fromTuple(frame.center1);
    const center2 = fromTuple(frame.center2);
    const normal1 = fromTuple(config.n1);
    const normal2 = fromTuple(config.n2);
    if (s.plane) { addPlane(this.dynamicLayer, center1, normal1, 4.9, 4.4, planeBlue, .11); addPlane(this.dynamicLayer, center2, normal2, 4.9, 4.4, 0x8bbf9f, .1); }
    if (s.line) { addLine(this.dynamicLayer, frame.line1.map(fromTuple), lineOrange, .072); addLine(this.dynamicLayer, frame.line2.map(fromTuple), lineBlue, .072); }
    if (s.burgers) { addArrow(this.dynamicLayer, center1.clone().add(V(0, 0, 1.35)), fromTuple(config.b1), lineOrange, .72); addArrow(this.dynamicLayer, center2.clone().add(V(0, 0, -1.35)), fromTuple(config.b2), lineBlue, .72); }
    if (p > .45 && s.line) addSphere(this.dynamicLayer, V(0, 0, 0), .11 + .08 * range(p, .45, .7), 0xf6bf6d, .8);
    if (s.trajectory) { addLine(this.dynamicLayer, [fromTuple(config.from1), V(0, 0, 0)], 0xd19884, .015, .55); addLine(this.dynamicLayer, [fromTuple(config.from2), V(0, 0, 0)], 0x9fbbdd, .015, .55); }
  }

  private drawPartial(id: SceneId, p: number, s: DisplayOptions, spacing: number) {
    const d = partialSeparation(id, p, spacing);
    if (s.plane) addPlane(this.dynamicLayer, V(0, 0, 0), V(0, 1, 0), 5.2, 4.3, planeBlue, .12);
    if (id === 'frank') {
      if (s.plane) addPlane(this.dynamicLayer, V(0, .02, 0), V(0, 1, 0), 2.5, 2.5, faultYellow, .32);
      if (s.line) addLoop(this.dynamicLayer, V(0, .05, 0), 1.24, lineOrange, 'xz');
      if (s.burgers) addArrow(this.dynamicLayer, V(.3, .1, 0), V(0, 1, 0), lineBlue, 1.1);
      return;
    }
    if (s.plane && d > .08) addPlane(this.dynamicLayer, V(0, .025, 0), V(0, 1, 0), d, 3.5, faultYellow, .32);
    const intact = id === 'extended' && p <= extendedDissociationStart;
    if (s.line) {
      if (intact) addLine(this.dynamicLayer, [V(0, .04, -1.8), V(0, .04, 1.8)], lineOrange, .078);
      else { addLine(this.dynamicLayer, [V(-d / 2, .04, -1.8), V(-d / 2, .04, 1.8)], lineOrange, .072); addLine(this.dynamicLayer, [V(d / 2, .04, -1.8), V(d / 2, .04, 1.8)], lineBlue, .072); }
    }
    if (s.burgers) {
      if (intact) addArrow(this.dynamicLayer, V(-.2, .25, 1.9), fromTuple(fullFccBurgersLocal), lineOrange);
      else { addArrow(this.dynamicLayer, V(-d / 2 - .2, .25, 1.9), fromTuple(leadingShockleyLocal), lineOrange); addArrow(this.dynamicLayer, V(d / 2 + .2, .25, 1.9), fromTuple(trailingShockleyLocal), lineBlue); }
    }
  }

  dispose() { disposeGroup(this.staticLayer); this.dynamicLayer.disposePool(); }
}
