/**
 * Terrain System
 * Generates procedural infinite desert with chunk-based loading
 */

import * as THREE from 'three';
import { Body, World, Box, Vec3 } from 'cannon-es';
import { SimplexNoise } from '../utils/noise';

interface TerrainChunk {
  mesh: THREE.Mesh;
  body: Body;
  position: { x: number; z: number };
  loaded: boolean;
}

export class TerrainSystem {
  private scene: THREE.Scene;
  private world: World;
  private noise: SimplexNoise;
  private chunks: Map<string, TerrainChunk> = new Map();
  private chunkSize = 128;
  private chunkResolution = 64;
  private loadDistance = 256;
  private unloadDistance = 384;
  private terrainMaterial: THREE.Material;

  constructor(scene: THREE.Scene, world: World, seed = 0) {
    this.scene = scene;
    this.world = world;
    this.noise = new SimplexNoise(seed);

    // Create sand material
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0xdaa520,
      metalness: 0.0,
      roughness: 0.9,
      map: this.createSandTexture(),
    });
  }

  private createSandTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create sandy texture
    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = Math.random() * 2;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
      ctx.fillRect(x, y, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  private getChunkKey(x: number, z: number): string {
    return `${Math.floor(x / this.chunkSize)},${Math.floor(z / this.chunkSize)}`;
  }

  private generateChunkMesh(chunkX: number, chunkZ: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.chunkResolution,
      this.chunkResolution
    );

    // Rotate to be horizontal
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const posArray = positions.array as Float32Array;

    // Set heights based on noise
    for (let i = 0; i < posArray.length; i += 3) {
      const x = posArray[i] + chunkX * this.chunkSize;
      const z = posArray[i + 2] + chunkZ * this.chunkSize;

      const height = this.noise.fbm(x * 0.001, z * 0.001, 6, 0.6, 2.0) * 15 +
                    this.noise.fbm(x * 0.01, z * 0.01, 3, 0.7, 2.0) * 3;

      posArray[i + 1] = Math.max(height, 0);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, this.terrainMaterial);
  }

  private generateChunkBody(chunkX: number, chunkZ: number, mesh: THREE.Mesh): Body {

    const body = new Body({ mass: 0 });

    // Create simplified collision shape using heightfield
    const heightData: number[] = [];
    const positions = (mesh.geometry as THREE.PlaneGeometry).attributes.position.array as Float32Array;

    const gridSize = this.chunkResolution + 1;
    for (let i = 0; i < gridSize * gridSize; i++) {
      heightData.push(positions[i * 3 + 1]);
    }

    // Use a flat box as a simplified collision surface for the chunk
    body.addShape(new Box(new Vec3(this.chunkSize / 2, 0.5, this.chunkSize / 2)));
    body.position.set(
      chunkX * this.chunkSize,
      0,
      chunkZ * this.chunkSize
    );

    return body;
  }

  private createChunk(chunkX: number, chunkZ: number): TerrainChunk {
    const mesh = this.generateChunkMesh(chunkX, chunkZ);
    mesh.position.set(
      chunkX * this.chunkSize,
      0,
      chunkZ * this.chunkSize
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = this.generateChunkBody(chunkX, chunkZ, mesh);

    this.scene.add(mesh);
    this.world.addBody(body);

    const key = this.getChunkKey(chunkX * this.chunkSize, chunkZ * this.chunkSize);
    const chunk: TerrainChunk = {
      mesh,
      body,
      position: { x: chunkX, z: chunkZ },
      loaded: true,
    };

    this.chunks.set(key, chunk);
    return chunk;
  }

  update(playerPos: THREE.Vector3): void {
    const playerChunkX = Math.floor(playerPos.x / this.chunkSize);
    const playerChunkZ = Math.floor(playerPos.z / this.chunkSize);

    // Load nearby chunks
    const loadRange = Math.ceil(this.loadDistance / this.chunkSize);
    for (let x = playerChunkX - loadRange; x <= playerChunkX + loadRange; x++) {
      for (let z = playerChunkZ - loadRange; z <= playerChunkZ + loadRange; z++) {
        const key = this.getChunkKey(x * this.chunkSize, z * this.chunkSize);
        if (!this.chunks.has(key)) {
          this.createChunk(x, z);
        }
      }
    }

    // Unload distant chunks
    this.chunks.forEach((chunk, key) => {
      const distance = Math.sqrt(
        Math.pow(chunk.position.x * this.chunkSize - playerPos.x, 2) +
        Math.pow(chunk.position.z * this.chunkSize - playerPos.z, 2)
      );

      if (distance > this.unloadDistance) {
        this.scene.remove(chunk.mesh);
        this.world.removeBody(chunk.body);
        this.chunks.delete(key);
      }
    });
  }

  getTerrainHeightAt(x: number, z: number): number {
    // Simple height estimation from noise
    return Math.max(
      this.noise.fbm(x * 0.001, z * 0.001, 6, 0.6, 2.0) * 15 +
      this.noise.fbm(x * 0.01, z * 0.01, 3, 0.7, 2.0) * 3,
      0
    );
  }

  dispose(): void {
    this.chunks.forEach((chunk) => {
      this.scene.remove(chunk.mesh);
      this.world.removeBody(chunk.body);
      chunk.mesh.geometry.dispose();
    });
    this.chunks.clear();
    (this.terrainMaterial as THREE.Material).dispose();
  }
}
