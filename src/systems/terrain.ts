/**
 * Terrain System
 * Infinite procedural desert — real dune topology, world-space UVs (no chunk
 * seams), vertex colour height-tinting, and accurate Heightfield physics.
 */

import * as THREE from 'three';
import { Body, World, Heightfield, Vec3 } from 'cannon-es';
import { SimplexNoise } from '../utils/noise';

interface TerrainChunk {
  mesh: THREE.Mesh;
  body: Body;
  cx  : number;
  cz  : number;
}

export class TerrainSystem {
  private scene : THREE.Scene;
  private world : World;
  private noise : SimplexNoise;
  private chunks = new Map<string, TerrainChunk>();

  private readonly CHUNK  = 128;
  private readonly RES    = 64;
  private readonly LOAD_R = 2;
  private readonly H_MAX  = 22;

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

    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        this.spawnChunk(x, z);
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

    // ── Base sand gradient (diagonal) ─────────────────────────────────────
    const grd = ctx.createLinearGradient(0, 0, S, S);
    grd.addColorStop(0.00, '#c8935a');
    grd.addColorStop(0.20, '#dba96a');
    grd.addColorStop(0.45, '#c88040');
    grd.addColorStop(0.70, '#b87030');
    grd.addColorStop(1.00, '#a06028');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, S, S);

    // ── Coarse sand grain ─────────────────────────────────────────────────
    for (let i = 0; i < 60000; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const r = Math.random() * 2.0;
      const a = Math.random() * 0.16;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255,215,140,${a})`
        : `rgba(75,40,8,${a})`;
      ctx.fillRect(x, y, r, r);
    }

    // ── Wind ripple lines — two crossing angles ────────────────────────────
    for (let pass = 0; pass < 3; pass++) {
      const angle = [-0.22, 0.15, -0.08][pass];
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(angle);
      ctx.strokeStyle = `rgba(155,100,35,${[0.06, 0.05, 0.04][pass]})`;
      ctx.lineWidth = 1;
      const spacing = [7, 11, 18][pass];
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

    // ── Shadow pockets (dune hollows) ─────────────────────────────────────
    for (let i = 0; i < 200; i++) {
      const x  = Math.random() * S;
      const y  = Math.random() * S;
      const rx = 6 + Math.random() * 40;
      const ry = 2 + Math.random() * 12;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g2.addColorStop(0, 'rgba(50,25,5,0.14)');
      g2.addColorStop(1, 'rgba(50,25,5,0)');
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(x, y * (rx / ry), rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Bright crest highlights ────────────────────────────────────────────
    for (let i = 0; i < 80; i++) {
      const x  = Math.random() * S;
      const y  = Math.random() * S;
      const rx = 4 + Math.random() * 20;
      const ry = 1 + Math.random() * 4;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g2.addColorStop(0, 'rgba(255,230,170,0.18)');
      g2.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(x, y * (rx / ry), rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(cv);
    // NO repeat wrapping — we use world-space UVs so the texture tiles
    // seamlessly across chunk boundaries at a large world scale
    tex.wrapS      = THREE.RepeatWrapping;
    tex.wrapT      = THREE.RepeatWrapping;
    tex.anisotropy = 16;
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

  // ── Material ──────────────────────────────────────────────────────────────

  private buildMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      map         : this.colorTex,
      normalMap   : this.normalTex,
      normalScale : new THREE.Vector2(1.4, 1.4),
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

  private buildChunkMesh(cx: number, cz: number): THREE.Mesh {
    const N   = this.RES;
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
    geo.computeVertexNormals();

    // ── World-space UVs — eliminates chunk seam tiling ────────────────────
    // Map world XZ → UV at a large scale so the texture tiles smoothly
    // across chunk boundaries with no visible grid.
    const uvArr = geo.attributes.uv.array as Float32Array;
    const UV_SCALE = 1 / 80; // one texture repeat every 80 world units
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
    const cTrough = new THREE.Color(0xa86828); // dark hollow
    const cMid    = new THREE.Color(0xc88840); // mid slope
    const cCrest  = new THREE.Color(0xf0d090); // bright crest

    for (let i = 0; i < vCount; i++) {
      const t = Math.min(heights[i] / this.H_MAX, 1);
      const c = new THREE.Color();
      if (t < 0.45) {
        c.lerpColors(cTrough, cMid, t / 0.45);
      } else {
        c.lerpColors(cMid, cCrest, (t - 0.45) / 0.55);
      }
      // Add slight random variation per vertex to break uniformity
      const jitter = (Math.random() - 0.5) * 0.04;
      colors[i * 3]     = Math.min(1, c.r + jitter);
      colors[i * 3 + 1] = Math.min(1, c.g + jitter * 0.8);
      colors[i * 3 + 2] = Math.min(1, c.b + jitter * 0.5);
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
    const N    = this.RES;
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

  private spawnChunk(cx: number, cz: number): void {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return;
    const mesh = this.buildChunkMesh(cx, cz);
    const body = this.buildChunkBody(cx, cz);
    this.scene.add(mesh);
    this.world.addBody(body);
    this.chunks.set(k, { mesh, body, cx, cz });
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

    for (let x = px - R; x <= px + R; x++)
      for (let z = pz - R; z <= pz + R; z++)
        this.spawnChunk(x, z);

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
