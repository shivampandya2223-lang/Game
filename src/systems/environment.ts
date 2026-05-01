/**
 * Environment Decoration System
 * Adds rocks, cacti, and other desert props
 */

import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';

export class EnvironmentSystem {
  private scene: THREE.Scene;
  private noise: SimplexNoise;
  private decorations: THREE.Mesh[] = [];
  private propSpacing = 30;
  private renderDistance = 200;

  constructor(scene: THREE.Scene, seed = 0) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);
  }

  private createRock(): THREE.Mesh {
    const geometry = new THREE.IcosahedronGeometry(
      0.5 + Math.random() * 1.5,
      2
    );
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(
        0.08,
        0.3 + Math.random() * 0.2,
        0.4 + Math.random() * 0.15
      ),
      metalness: 0.1,
      roughness: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Random rotation for variety
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    return mesh;
  }

  private createCactus(): THREE.Mesh {
    const group = new THREE.Group() as any as THREE.Mesh;

    // Main stem
    const stemGeometry = new THREE.CylinderGeometry(0.4, 0.5, 3, 8);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a7c3e,
      metalness: 0,
      roughness: 0.9,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.castShadow = true;
    stem.receiveShadow = true;
    group.add(stem);

    // Arms (small branches)
    const armGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.5, 6);
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a7c3e,
      metalness: 0,
      roughness: 0.9,
    });

    const armPositions = [
      { x: 1, z: 0, ry: Math.PI / 4 },
      { x: -1, z: 0, ry: -Math.PI / 4 },
      { x: 0, z: 1, ry: 0 },
      { x: 0, z: -1, ry: Math.PI },
    ];

    armPositions.forEach((pos) => {
      const arm = new THREE.Mesh(armGeometry, armMaterial);
      arm.position.set(pos.x, 1, pos.z);
      arm.rotation.z = Math.PI / 4;
      arm.castShadow = true;
      arm.receiveShadow = true;
      group.add(arm);
    });

    return group as any;
  }

  private createShrub(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.8, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.3, 0.6, 0.4),
      metalness: 0,
      roughness: 0.95,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.y = 0.6;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  update(playerPos: THREE.Vector3, terrainHeightFn: (x: number, z: number) => number): void {
    const gridX = Math.floor(playerPos.x / this.propSpacing);
    const gridZ = Math.floor(playerPos.z / this.propSpacing);

    // Generate decorations around player
    for (let x = gridX - 3; x <= gridX + 3; x++) {
      for (let z = gridZ - 3; z <= gridZ + 3; z++) {
        const key = `${x},${z}`;
        const existingDecorations = this.decorations.filter(
          (d) => (d as any).__gridKey === key
        );

        if (existingDecorations.length === 0) {
          this.generateGridCell(x, z, terrainHeightFn);
        }
      }
    }

    // Remove distant decorations
    for (let i = this.decorations.length - 1; i >= 0; i--) {
      const decoration = this.decorations[i];
      const distance = playerPos.distanceTo(decoration.position);

      if (distance > this.renderDistance) {
        this.scene.remove(decoration);
        decoration.geometry.dispose();
        (decoration.material as any).dispose?.();
        this.decorations.splice(i, 1);
      }
    }
  }

  private generateGridCell(gridX: number, gridZ: number, terrainHeightFn: (x: number, z: number) => number): void {
    const cellX = gridX * this.propSpacing;
    const cellZ = gridZ * this.propSpacing;

    // Use noise to determine what props to place
    const propNoise = this.noise.fbm(cellX * 0.01, cellZ * 0.01, 2, 0.5, 2.0);
    const countNoise = this.noise.noise(cellX * 0.02, cellZ * 0.02);

    const propType = Math.floor(propNoise * 3);
    const propCount = Math.floor(Math.abs(countNoise) * 3) + 1;

    for (let i = 0; i < propCount; i++) {
      const offsetX = cellX + (Math.random() - 0.5) * this.propSpacing;
      const offsetZ = cellZ + (Math.random() - 0.5) * this.propSpacing;

      const heightOffset = this.noise.noise(offsetX * 0.005, offsetZ * 0.005) * 2;
      const height = terrainHeightFn(offsetX, offsetZ) + heightOffset;

      let mesh: THREE.Mesh;

      switch (propType) {
        case 0:
          mesh = this.createRock();
          break;
        case 1:
          mesh = this.createCactus();
          break;
        default:
          mesh = this.createShrub();
      }

      mesh.position.set(offsetX, height, offsetZ);
      (mesh as any).__gridKey = `${gridX},${gridZ}`;

      this.scene.add(mesh);
      this.decorations.push(mesh);
    }
  }

  dispose(): void {
    this.decorations.forEach((decoration) => {
      this.scene.remove(decoration);
      if (decoration.geometry) decoration.geometry.dispose();
      if (decoration.material) {
        const material = decoration.material as any;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    });
    this.decorations = [];
  }
}
