import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DefectScene } from './defectScene';
import type { DisplayOptions } from '../domain/modelTypes';

const options: DisplayOptions = {
  atoms: true, lattice: false, line: true, burgers: true, plane: true,
  trajectory: true, extraHalfPlane: true, stress: true, surfaceStep: true,
};

describe('animated render resource reuse', () => {
  it('updates line vertices without replacing scene objects or GPU buffer identities each frame', () => {
    const visual = new DefectScene();
    visual.update('edge-glide', .1, options);
    const staticLayer = visual.scene.children.at(-2) as THREE.Group;
    const dynamicLayer = visual.scene.children.at(-1) as THREE.Group;
    const atomId = staticLayer.children[0].uuid;
    const objectIds = dynamicLayer.children.map(child => child.uuid);
    const geometryIds: string[] = [];
    dynamicLayer.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometryIds.push(mesh.geometry.uuid);
    });
    const dislocation = dynamicLayer.children[2].children[0] as THREE.Mesh<THREE.BufferGeometry>;
    const before = (dislocation.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0);

    visual.update('edge-glide', .2, options);
    const afterIds: string[] = [];
    dynamicLayer.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) afterIds.push(mesh.geometry.uuid);
    });
    expect(staticLayer.children[0].uuid).toBe(atomId);
    expect(dynamicLayer.children.map(child => child.uuid)).toEqual(objectIds);
    expect(afterIds).toEqual(geometryIds);
    expect((dislocation.geometry.getAttribute('position') as THREE.BufferAttribute).getX(0)).not.toBe(before);
    visual.dispose();
  });
  it('keeps atom instances when only overlays change, and rebuilds them when atoms change', () => {
    const visual = new DefectScene();
    visual.update('edge', .3, options);
    const staticLayer = visual.scene.children.at(-2) as THREE.Group;
    const atomId = staticLayer.children[0].uuid;
    visual.update('edge', .3, { ...options, line: false });
    expect(staticLayer.children[0].uuid).toBe(atomId);
    visual.update('edge', .3, { ...options, trajectory: false });
    expect(staticLayer.children[0].uuid).toBe(atomId);
    visual.update('edge', .3, { ...options, lattice: true });
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh).uuid).toBe(atomId);
    visual.update('edge', .3, { ...options, extraHalfPlane: false });
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh).uuid).toBe(atomId);
    visual.update('edge', .3, options);
    const extraId = (staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 10) as THREE.InstancedMesh).uuid;
    visual.update('edge', .3, { ...options, atoms: false });
    expect(staticLayer.children).toHaveLength(1);
    expect(staticLayer.children[0].uuid).toBe(extraId);
    visual.update('edge', .3, options);
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 175) as THREE.InstancedMesh).uuid).not.toBe(atomId);
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 10) as THREE.InstancedMesh).uuid).toBe(extraId);
    visual.dispose();
  });
  it('does not duplicate glide atoms with a second orange half-plane column', () => {
    const visual = new DefectScene();
    const staticLayer = visual.scene.children.at(-2) as THREE.Group;
    const dynamicLayer = visual.scene.children.at(-1) as THREE.Group;
    for (const progress of [0, .5, 1]) {
      visual.update('edge-glide', progress, options);
      expect(staticLayer.children.filter(child => child instanceof THREE.InstancedMesh && child.count === 10)).toHaveLength(0);
    }
    const finalWithGuide = dynamicLayer.children.filter(child => child.visible).length;
    visual.update('edge-glide', 1, { ...options, extraHalfPlane: false });
    expect(dynamicLayer.children.filter(child => child.visible).length).toBe(finalWithGuide);
    const finalWithLine = dynamicLayer.children.filter(child => child.visible).length;
    visual.update('edge-glide', 1, { ...options, extraHalfPlane: false, line: false });
    expect(dynamicLayer.children.filter(child => child.visible).length).toBe(finalWithLine);
    visual.dispose();
  });
  it('aligns the glide line and half-plane guide with the interlayer slip plane', () => {
    const visual = new DefectScene();
    visual.update('edge-glide', .5, options);
    const dynamic = visual.scene.children.at(-1) as THREE.Group;
    expect(dynamic.children[0].position.y).toBeCloseTo(-.375);
    expect(dynamic.children[1].position.y - (dynamic.children[1].scale.y / 2)).toBeCloseTo(-.375);
    const line = dynamic.children[2].children[0] as THREE.Mesh<THREE.BufferGeometry>;
    line.geometry.computeBoundingBox();
    const bounds = line.geometry.boundingBox!;
    expect((bounds.min.y + bounds.max.y) / 2).toBeCloseTo(-.375);
    visual.dispose();
  });
  it('moves edge-glide atom highlighting with the core and clears it after exit', () => {
    const visual = new DefectScene();
    const color = new THREE.Color();
    const inspect = (progress: number, i: number) => {
      visual.update('edge-glide', progress, options);
      const staticLayer = visual.scene.children.at(-2) as THREE.Group;
      const atoms = staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 175) as THREE.InstancedMesh;
      atoms.getColorAt(2 * 35 + 3 * 7 + i + 3, color);
      return color.getHex();
    };
    const earlyLeft = inspect(.2, -2);
    const earlyRight = inspect(.2, 2);
    expect(earlyLeft).not.toBe(earlyRight);
    expect(inspect(.7, -2)).toBe(earlyRight);
    expect(inspect(.7, 2)).toBe(earlyLeft);
    expect(inspect(1, 2)).toBe(earlyRight);
    visual.dispose();
  });
  it('hides stress arrows independently and keeps the screw surface step when its plane is hidden', () => {
    const visual = new DefectScene();
    const dynamic = visual.scene.children.at(-1) as THREE.Group;
    visual.update('edge-glide', .2, options);
    const withStress = dynamic.children.filter(child => child.visible).length;
    visual.update('edge-glide', .2, { ...options, stress: false });
    expect(dynamic.children.filter(child => child.visible).length).toBe(withStress - 4);
    visual.update('screw', 0, { ...options, plane: false, surfaceStep: true });
    const withStep = dynamic.children.filter(child => child.visible).length;
    visual.update('screw', 0, { ...options, plane: false, surfaceStep: false });
    expect(dynamic.children.filter(child => child.visible).length).toBe(withStep - 5);
    visual.dispose();
  });
  it('shortens the climbing extra half-plane without raising its upper atom row', () => {
    const visual = new DefectScene();
    visual.update('edge-climb', 0, options);
    const staticLayer = visual.scene.children.at(-2) as THREE.Group;
    const extra = staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 10) as THREE.InstancedMesh;
    const startTop = new THREE.Matrix4();
    extra.getMatrixAt(1, startTop);
    visual.update('edge-climb', 1, options);
    const endTop = new THREE.Matrix4();
    const endBottom = new THREE.Matrix4();
    extra.getMatrixAt(1, endTop);
    extra.getMatrixAt(0, endBottom);
    expect(new THREE.Vector3().setFromMatrixPosition(endTop).y).toBeCloseTo(new THREE.Vector3().setFromMatrixPosition(startTop).y);
    expect(new THREE.Vector3().setFromMatrixScale(endBottom).x).toBeCloseTo(0);
    visual.dispose();
  });
});
