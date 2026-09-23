import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DefectScene } from './defectScene';
import type { DisplayOptions } from '../domain/modelTypes';

const options: DisplayOptions = {
  atoms: true, lattice: false, line: true, burgers: true, plane: true,
  trajectory: true, extraHalfPlane: true,
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
    visual.update('edge-glide', .3, { ...options, atoms: false });
    expect(staticLayer.children).toHaveLength(0);
    visual.update('edge-glide', .3, options);
    expect(staticLayer.children[0].uuid).not.toBe(atomId);
    visual.dispose();
  });
});
