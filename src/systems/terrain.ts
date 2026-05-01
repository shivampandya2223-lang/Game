/**
 * Terrain System
 * Infinite procedural desert — warm sand dunes, never ending
 */

import * as THREE from 'three';
import { Body, World, Box, Vec3 } from 'cannon-es';
import { SimplexNoise } from '../utils/noise';

interface TerrainChunk {
  mesh: THREE.Mesh;
  body: Body;
  chunkX: number;
  chunkZ: number;
}

export class TerrainSystem {
  private scene: THREE.Scene;
  private world: World;
  private noise: SimplexNoise;
  private chunks = new Map<string, TerrainChunk>();

  // Chunk settings
  private readonly CHUNK   = 128;   // world units per chunk
  private readonly RES     = 80;    // vertex resolution per chunk
  private readonly LOAD_R  = 2;     // chunks radius to keep loaded
  private readonly HEIGHT  = 18;    // max dune height

  private terrainMat: THREE.Material;

  constructor(scene: THREE.Scene, world: World, seed = 42) {
    this.scene = scene;
    this.world = world;
    this.noise = new SimplexNoise(seed);
    this.terrainMat = this.buildMaterial();

    // Pre-load the 5×5 area around origin
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        this.spawnChunk(x, z);
  }

  // ── Material ──────────────────────────────────────────────────────────────

  private buildMaterial(): THREE.Material {
    // Procedural canvas texture: warm sand gradient with subtle grain
    const size = 512;
    const cv   = document.createElement('canvas');
    cv.width   = size;
    cv.height  = size;
    const ctx  = cv.getContext('2d')!;

    const grd = ctx.createLinearGradient(0, 0, size, size);
    grd.addColorStop(0,    '#c2975a');
    grd.addColorStop(0.35, '#d4a96a');
    grd.addColorStop(0.65, '#c08040');
    grd.addColorStop(1,    '#b87030');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);

    // Sand grain noise
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.4;
      const a = Math.random() * 0.13;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,220,160' : '90,55,20'},${a})`;
      ctx.fillRect(x, y, r, r);
    }

    // Subtle ripple lines (wind marks)
    ctx.strokeStyle = 'rgba(180,130,60,0.08)';
    ctx.lineWidth   = 1;
    for (let y = 0; y < size; y += 12) {
      ctx.beginPath();
      for (let x = 0; x < size; x++) {
        const wave = Math.sin((x + y * 0.3) * 0.15) * 3;
        ctx[x === 0 ? 'moveTo' : 'lineTo'](x, y + wave);
      }
      ctx.stroke();
    }

    const tex       = new THREE.CanvasTexture(cv);
    tex.wrapS       = THREE.RepeatWrapping;
    tex.wrapT       = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);

    return new THREE.MeshStandardMaterial({
      map      : tex,
      color    : new THREE.Color(0xd4a96a),
      roughness: 0.95,
      metalness: 0.0,
    });
  }

  // ── Height function ────────────────────────────────────────────────────────

  getTerrainHeightAt(wx: number, wz: number): number {
    const n = this.noise;
    // Large rolling dunes
    const macro = n.fbm(wx * 0.0018, wz * 0.0018, 5, 0.55, 2.1) * this.HEIGHT;
    // Medium ripples
    const mid   = n.fbm(wx * 0.008,  wz * 0.008,  3, 0.6,  2.0) * 3.5;
    // Fine surface detail
    const fine  = n.noise(wx * 0.04, wz * 0.04) * 0.6;
    return Math.max(macro + mid + fine, 0);
  }

  // ── Chunk mesh ────────────────────────────────────────────────────────────

  private buildChunkMesh(cx: number, cz: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(this.CHUNK, this.CHUNK, this.RES, this.RES);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const wx = pos[i]     + cx * this.CHUNK;
      const wz = pos[i + 2] + cz * this.CHUNK;
      pos[i + 1] = this.getTerrainHeightAt(wx, wz);
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(cx * this.CHUNK, 0, cz * this.CHUNK);
    mesh.receiveShadow = true;
    mesh.castShadow    = false;
    return mesh;
  }

  // ── Chunk body ────────────────────────────────────────────────────────────

  private buildChunkBody(cx: number, cz: number): Body {
    const half = this.CHUNK / 2;
    const body = new Body({ mass: 0 });
    body.addShape(new Box(new Vec3(half, 1, half)));
    body.position.set(cx * this.CHUNK, -1, cz * this.CHUNK);
    return body;
  }

  // ── Spawn / despawn ────────────────────────────────────────────────────────

  private key(cx: number, cz: number) { return `${cx},${cz}`; }

  private spawnChunk(cx: number, cz: number): void {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return;

    const mesh = this.buildChunkMesh(cx, cz);
    const body = this.buildChunkBody(cx, cz);

    this.scene.add(mesh);
    this.world.addBody(body);
    this.chunks.set(k, { mesh, body, chunkX: cx, chunkZ: cz });
  }

  private removeChunk(k: string): void {
    const c = this.chunks.get(k);
    if (!c) return;
    this.scene.remove(c.mesh);
    this.world.removeBody(c.body);
    c.mesh.geometry.dispose();
    this.chunks.delete(k);
  }

  // ── Update (streaming) ─────────────────────────────────────────────────────

  update(playerPos: THREE.Vector3): void {
    const px = Math.round(playerPos.x / this.CHUNK);
    const pz = Math.round(playerPos.z / this.CHUNK);
    const R  = this.LOAD_R;

    // Load nearby
    for (let x = px - R; x <= px + R; x++)
      for (let z = pz - R; z <= pz + R; z++)
        this.spawnChunk(x, z);

    // Unload distant
    this.chunks.forEach((_, k) => {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - px) > R + 1 || Math.abs(cz - pz) > R + 1)
        this.removeChunk(k);
    });
  }

  dispose(): void {
    this.chunks.forEach((_, k) => this.removeChunk(k));
    (this.terrainMat as THREE.Material).dispose();
  }
}
