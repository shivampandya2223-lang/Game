/**
 * Terrain System
 * Infinite procedural desert — real dune topology, world-space UVs (no chunk
 * seams), vertex colour height-tinting, and accurate Heightfield physics.
 */

import * as THREE from 'three';
import { Body, World, Heightfield } from 'cannon-es';
import { SimplexNoise } from '../utils/noise';

interface TerrainChunk {
  mesh: THREE.Mesh;
  body?: Body;
  cx  : number;
  cz  : number;
  lod : 'near' | 'far';
}

export class TerrainSystem {
  private scene : THREE.Scene;
  private world : World;
  private noise : SimplexNoise;
  private chunks = new Map<string, TerrainChunk>();

  private readonly CHUNK  = 128;
  private readonly RES_NEAR  = 64;
  private readonly RES_FAR   = 18;
  private readonly PHYSICS_R = 3;
  private readonly VISUAL_R  = 9;
  private readonly H_MAX  = 22;
  private readonly NORMAL_SAMPLE = 1.75;

  // Single shared material — world-space UVs eliminate seams
  private terrainMat!: THREE.MeshStandardMaterial;

  // Shared textures (built once, reused across all chunks)
  private colorTex!: THREE.CanvasTexture;
  private normalTex!: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, world: World, seed = 42) {
    this.scene = scene;
    this.world = world;
    this.noise = new SimplexNoise(seed);

    this.buildTextures();
    this.terrainMat = this.buildMaterial();

    for (let x = -this.VISUAL_R; x <= this.VISUAL_R; x++)
      for (let z = -this.VISUAL_R; z <= this.VISUAL_R; z++)
        this.ensureChunk(x, z, this.getDesiredLod(x, z, 0, 0));
  }

  // ── Textures ──────────────────────────────────────────────────────────────

  private buildTextures(): void {
    this.colorTex  = this.buildColorTexture(1024);
    this.normalTex = this.buildNormalTexture(512);
  }

  private buildColorTexture(S: number): THREE.CanvasTexture {
    const cv  = document.createElement('canvas');
    cv.width  = S; cv.height = S;
    const ctx = cv.getContext('2d')!;

    // Neutral tileable sand detail. Large colour variation belongs in
    // world-space vertex colours so chunk/texture borders never show.
    ctx.fillStyle = '#a86f35';
    ctx.fillRect(0, 0, S, S);

    // ── Coarse sand grain ─────────────────────────────────────────────────
    for (let i = 0; i < 90000; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = Math.random() * 1.35;
      const a = Math.random() * 0.10;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(210,164,96,${a})`
        : `rgba(82,54,28,${a})`;
      ctx.fillRect(x, y, r, r);
    }

    // ── Wind ripple lines. Keep these subtle so repetition reads as sand
    // grain, not as square texture tiles.
    for (let pass = 0; pass < 2; pass++) {
      const angle = [-0.18, 0.11][pass];
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(angle);
      ctx.strokeStyle = `rgba(94,67,34,${[0.035, 0.025][pass]})`;
      ctx.lineWidth = 1;
      const spacing = [9, 15][pass];
      for (let y = -S * 1.5; y < S * 1.5; y += spacing) {
        ctx.beginPath();
        for (let x = -S * 1.5; x < S * 1.5; x += 2) {
          const wave = Math.sin(x * 0.035 + y * 0.008) * 5
                     + Math.sin(x * 0.012) * 3;
          ctx[x === -S * 1.5 ? 'moveTo' : 'lineTo'](x, y + wave);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(cv);
    // NO repeat wrapping — we use world-space UVs so the texture tiles
    // seamlessly across chunk boundaries at a large world scale
    tex.wrapS      = THREE.RepeatWrapping;
    tex.wrapT      = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildNormalTexture(S: number): THREE.CanvasTexture {
    const cv  = document.createElement('canvas');
    cv.width  = S; cv.height = S;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(S, S);
    const d   = img.data;

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const fx = x / S, fy = y / S;
        // Multi-frequency micro-surface
        const hL = this.sampleMicro(fx - 1 / S, fy);
        const hR = this.sampleMicro(fx + 1 / S, fy);
        const hD = this.sampleMicro(fx, fy - 1 / S);
        const hU = this.sampleMicro(fx, fy + 1 / S);
        const nx = (hL - hR) * 0.5 + 0.5;
        const ny = (hD - hU) * 0.5 + 0.5;
        const i  = (y * S + x) * 4;
        d[i]     = Math.floor(nx * 255);
        d[i + 1] = Math.floor(ny * 255);
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  private sampleMicro(x: number, y: number): number {
    return (
      this.noise.noise(x * 38, y * 38) * 0.5 +
      this.noise.noise(x * 80, y * 80) * 0.3 +
      this.noise.noise(x * 160, y * 160) * 0.2
    ) * 0.5 + 0.5;
  }

  private hash2(x: number, z: number): number {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  private getTerrainNormalAt(wx: number, wz: number): THREE.Vector3 {
    const e = this.NORMAL_SAMPLE;
    const hL = this.getTerrainHeightAt(wx - e, wz);
    const hR = this.getTerrainHeightAt(wx + e, wz);
    const hD = this.getTerrainHeightAt(wx, wz - e);
    const hU = this.getTerrainHeightAt(wx, wz + e);
    return new THREE.Vector3(hL - hR, e * 2, hD - hU).normalize();
  }

  // ── Material ──────────────────────────────────────────────────────────────

  private buildMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      map         : this.colorTex,
      normalMap   : this.normalTex,
      normalScale : new THREE.Vector2(0.55, 0.55),
      roughness   : 0.97,
      metalness   : 0.0,
      vertexColors: true,   // height-based tinting blended on top
    });
  }

  // ── Height function ────────────────────────────────────────────────────────

  getTerrainHeightAt(wx: number, wz: number): number {
    const n = this.noise;
    // Large rolling dunes
    const macro = n.fbm(wx * 0.0014, wz * 0.0014, 6, 0.52, 2.1) * this.H_MAX;
    // Medium cross-dunes
    const mid   = n.fbm(wx * 0.006,  wz * 0.006,  4, 0.58, 2.0) * 5.5;
    // Sharp ridge crests
    const ridgeRaw = n.fbm(wx * 0.0028, wz * 0.0028, 3, 0.6, 2.0);
    const ridge    = (1 - Math.abs(ridgeRaw)) * 5.0;
    // Fine surface ripples
    const fine  = n.noise(wx * 0.055, wz * 0.055) * 0.7;
    return Math.max(macro + mid + ridge + fine, 0);
  }

  // ── Chunk mesh — world-space UVs ──────────────────────────────────────────

  private buildChunkMesh(cx: number, cz: number, resolution: number): THREE.Mesh {
    const N   = resolution;
    const geo = new THREE.PlaneGeometry(this.CHUNK, this.CHUNK, N, N);
    geo.rotateX(-Math.PI / 2);

    const posArr = geo.attributes.position.array as Float32Array;
    const vCount = (N + 1) * (N + 1);
    const heights = new Float32Array(vCount);

    // Apply height displacement
    for (let i = 0; i < vCount; i++) {
      const wx = posArr[i * 3]     + cx * this.CHUNK;
      const wz = posArr[i * 3 + 2] + cz * this.CHUNK;
      const h  = this.getTerrainHeightAt(wx, wz);
      posArr[i * 3 + 1] = h;
      heights[i]        = h;
    }
    geo.attributes.position.needsUpdate = true;

    // World-space normals keep lighting continuous across chunk edges.
    const normalArr = geo.attributes.normal.array as Float32Array;
    for (let i = 0; i < vCount; i++) {
      const wx = posArr[i * 3]     + cx * this.CHUNK;
      const wz = posArr[i * 3 + 2] + cz * this.CHUNK;
      const n = this.getTerrainNormalAt(wx, wz);
      normalArr[i * 3]     = n.x;
      normalArr[i * 3 + 1] = n.y;
      normalArr[i * 3 + 2] = n.z;
    }
    geo.attributes.normal.needsUpdate = true;

    // ── World-space UVs — eliminates chunk seam tiling ────────────────────
    // Map world XZ → UV at a large scale so the texture tiles smoothly
    // across chunk boundaries with no visible grid.
    const uvArr = geo.attributes.uv.array as Float32Array;
    const UV_SCALE = 1 / 22; // fine sand grain; no large repeated patches
    for (let i = 0; i < vCount; i++) {
      const wx = posArr[i * 3]     + cx * this.CHUNK;
      const wz = posArr[i * 3 + 2] + cz * this.CHUNK;
      uvArr[i * 2]     = wx * UV_SCALE;
      uvArr[i * 2 + 1] = wz * UV_SCALE;
    }
    geo.attributes.uv.needsUpdate = true;

    // Also remap the normal map UVs at a finer scale for micro-detail
    // We store them in uv2 so the material can use them separately
    const uv2 = new Float32Array(vCount * 2);
    const NM_SCALE = 1 / 12;
    for (let i = 0; i < vCount; i++) {
      const wx = posArr[i * 3]     + cx * this.CHUNK;
      const wz = posArr[i * 3 + 2] + cz * this.CHUNK;
      uv2[i * 2]     = wx * NM_SCALE;
      uv2[i * 2 + 1] = wz * NM_SCALE;
    }
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv2, 2));

    // ── Vertex colours — height-based tinting ─────────────────────────────
    const colors = new Float32Array(vCount * 3);
    const cTrough = new THREE.Color(0x72502b); // compact shadowed sand
    const cMid    = new THREE.Color(0x9b6a35); // dry desert brown
    const cCrest  = new THREE.Color(0xc1904d); // muted sunlit crest

    for (let i = 0; i < vCount; i++) {
      const wx = posArr[i * 3]     + cx * this.CHUNK;
      const wz = posArr[i * 3 + 2] + cz * this.CHUNK;
      const t = Math.min(heights[i] / this.H_MAX, 1);
      const c = new THREE.Color();
      if (t < 0.45) {
        c.lerpColors(cTrough, cMid, t / 0.45);
      } else {
        c.lerpColors(cMid, cCrest, (t - 0.45) / 0.55);
      }
      const broad = this.noise.fbm(wx * 0.0022, wz * 0.0022, 3, 0.55, 2.0) * 0.065;
      const fine = (this.hash2(wx * 0.8, wz * 0.8) - 0.5) * 0.018;
      const tint = broad + fine;
      colors[i * 3]     = THREE.MathUtils.clamp(c.r + tint, 0, 1);
      colors[i * 3 + 1] = THREE.MathUtils.clamp(c.g + tint * 0.72, 0, 1);
      colors[i * 3 + 2] = THREE.MathUtils.clamp(c.b + tint * 0.40, 0, 1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(cx * this.CHUNK, 0, cz * this.CHUNK);
    mesh.receiveShadow = true;
    mesh.castShadow    = false;
    return mesh;
  }

  // ── Chunk physics body — Heightfield for accurate collision ───────────────

  private buildChunkBody(cx: number, cz: number): Body {
    const N    = this.RES_NEAR;
    const step = this.CHUNK / N;

    const matrix: number[][] = [];
    for (let row = 0; row <= N; row++) {
      const rowArr: number[] = [];
      for (let col = 0; col <= N; col++) {
        const wx = cx * this.CHUNK - this.CHUNK / 2 + col * step;
        const wz = cz * this.CHUNK - this.CHUNK / 2 + row * step;
        rowArr.push(this.getTerrainHeightAt(wx, wz));
      }
      matrix.push(rowArr);
    }

    const shape = new Heightfield(matrix, { elementSize: step });
    const body  = new Body({ mass: 0 });
    body.addShape(shape);
    body.position.set(
      cx * this.CHUNK - this.CHUNK / 2,
      0,
      cz * this.CHUNK - this.CHUNK / 2
    );
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    return body;
  }

  // ── Spawn / despawn ────────────────────────────────────────────────────────

  private key(cx: number, cz: number) { return `${cx},${cz}`; }

  private getDesiredLod(cx: number, cz: number, px: number, pz: number): 'near' | 'far' {
    return Math.max(Math.abs(cx - px), Math.abs(cz - pz)) <= this.PHYSICS_R ? 'near' : 'far';
  }

  private ensureChunk(cx: number, cz: number, lod: 'near' | 'far'): void {
    const k = this.key(cx, cz);
    const existing = this.chunks.get(k);

    if (!existing) {
      const mesh = this.buildChunkMesh(cx, cz, lod === 'near' ? this.RES_NEAR : this.RES_FAR);
      const body = lod === 'near' ? this.buildChunkBody(cx, cz) : undefined;
      this.scene.add(mesh);
      if (body) this.world.addBody(body);
      this.chunks.set(k, { mesh, body, cx, cz, lod });
      return;
    }

    if (existing.lod !== lod) {
      this.scene.remove(existing.mesh);
      existing.mesh.geometry.dispose();
      existing.mesh = this.buildChunkMesh(cx, cz, lod === 'near' ? this.RES_NEAR : this.RES_FAR);
      existing.lod = lod;
      this.scene.add(existing.mesh);
    }

    if (lod === 'near' && !existing.body) {
      existing.body = this.buildChunkBody(cx, cz);
      this.world.addBody(existing.body);
    } else if (lod === 'far' && existing.body) {
      this.world.removeBody(existing.body);
      existing.body = undefined;
    }
  }

  private removeChunk(k: string): void {
    const c = this.chunks.get(k);
    if (!c) return;
    this.scene.remove(c.mesh);
    if (c.body) this.world.removeBody(c.body);
    c.mesh.geometry.dispose();
    this.chunks.delete(k);
  }

  // ── Update (streaming) ─────────────────────────────────────────────────────

  update(playerPos: THREE.Vector3): void {
    const px = Math.round(playerPos.x / this.CHUNK);
    const pz = Math.round(playerPos.z / this.CHUNK);
    const R  = this.VISUAL_R;

    for (let x = px - R; x <= px + R; x++)
      for (let z = pz - R; z <= pz + R; z++)
        this.ensureChunk(x, z, this.getDesiredLod(x, z, px, pz));

    this.chunks.forEach((_, k) => {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - px) > R + 1 || Math.abs(cz - pz) > R + 1)
        this.removeChunk(k);
    });
  }

  dispose(): void {
    this.chunks.forEach((_, k) => this.removeChunk(k));
    this.terrainMat.dispose();
    this.colorTex.dispose();
    this.normalTex.dispose();
  }
}
