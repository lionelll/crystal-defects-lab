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
    visual.update('edge-glide', .3, options);
    const staticLayer = visual.scene.children.at(-2) as THREE.Group;
    const atomId = staticLayer.children[0].uuid;
    visual.update('edge-glide', .3, { ...options, line: false });
    expect(staticLayer.children[0].uuid).toBe(atomId);
    visual.update('edge-glide', .3, { ...options, trajectory: false });
    expect(staticLayer.children[0].uuid).toBe(atomId);
    visual.update('edge-glide', .3, { ...options, lattice: true });
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh).uuid).toBe(atomId);
    visual.update('edge-glide', .3, { ...options, extraHalfPlane: false });
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh).uuid).toBe(atomId);
    visual.update('edge-glide', .3, options);
    const extraId = (staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 10) as THREE.InstancedMesh).uuid;
    visual.update('edge-glide', .3, { ...options, atoms: false });
    expect(staticLayer.children).toHaveLength(1);
    expect(staticLayer.children[0].uuid).toBe(extraId);
    visual.update('edge-glide', .3, options);
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 175) as THREE.InstancedMesh).uuid).not.toBe(atomId);
    expect((staticLayer.children.find(child => child instanceof THREE.InstancedMesh && child.count === 10) as THREE.InstancedMesh).uuid).toBe(extraId);
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
});
