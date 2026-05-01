/**
 * Environment System
 * Scatter desert props: sandstone rocks, cacti, dead shrubs, distant mesas
 */

import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';

export class EnvironmentSystem {
  private scene: THREE.Scene;
  private noise: SimplexNoise;
  private props: Map<string, THREE.Object3D[]> = new Map();

  private readonly CELL   = 40;   // grid spacing between prop slots
  private readonly RADIUS = 4;    // cells to keep around player

  // Shared materials (reused across all props)
  private matRock:   THREE.MeshStandardMaterial;
  private matCactus: THREE.MeshStandardMaterial;
  private matShrub:  THREE.MeshStandardMaterial;
  private matBark:   THREE.MeshStandardMaterial;
  private matMesa:   THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, seed = 0) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);

    this.matRock   = new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 0.95, metalness: 0.0 });
    this.matCactus = new THREE.MeshStandardMaterial({ color: 0x4a7a30, roughness: 0.9,  metalness: 0.0 });
    this.matShrub  = new THREE.MeshStandardMaterial({ color: 0x7a6a30, roughness: 1.0,  metalness: 0.0 });
    this.matBark   = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 1.0,  metalness: 0.0 });
    this.matMesa   = new THREE.MeshStandardMaterial({ color: 0xb87040, roughness: 0.9,  metalness: 0.0 });
  }

  // ── Prop factories ────────────────────────────────────────────────────────

  private makeRock(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const r    = 0.5 + rng() * 2.5;
      const geo  = new THREE.IcosahedronGeometry(r, 1);
      // Warp vertices for organic look
      const pos  = geo.attributes.position.array as Float32Array;
      for (let j = 0; j < pos.length; j += 3) {
        pos[j]     += (rng() - 0.5) * r * 0.35;
        pos[j + 1] += (rng() - 0.5) * r * 0.25;
        pos[j + 2] += (rng() - 0.5) * r * 0.35;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.matRock);
      mesh.position.set((rng() - 0.5) * 2, r * 0.6, (rng() - 0.5) * 2);
      mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  private makeCactus(rng: () => number): THREE.Object3D {
    const g    = new THREE.Group();
    const h    = 3 + rng() * 4;
    // Main stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h, 8), this.matCactus);
    stem.position.y = h / 2;
    stem.castShadow = true;
    g.add(stem);
    // Arms
    const arms = Math.floor(rng() * 3);
    for (let i = 0; i < arms; i++) {
      const ah  = 1 + rng() * 2;
      const arm = new THREE.Group();
      const hSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), this.matCactus);
      hSeg.rotation.z = Math.PI / 2;
      hSeg.position.x = 0.6;
      const vSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, ah, 6), this.matCactus);
      vSeg.position.set(1.2, ah / 2, 0);
      arm.add(hSeg, vSeg);
      arm.rotation.y = (i / arms) * Math.PI * 2 + rng();
      arm.position.y = h * (0.4 + rng() * 0.4);
      arm.castShadow = true;
      g.add(arm);
    }
    return g;
  }

  private makeShrub(rng: () => number): THREE.Object3D {
    const g   = new THREE.Group();
    const n   = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const r    = 0.3 + rng() * 0.6;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 5, 4), this.matShrub);
      ball.scale.y = 0.55;
      ball.position.set((rng() - 0.5) * 1.4, r * 0.4, (rng() - 0.5) * 1.4);
      ball.castShadow = true;
      g.add(ball);
    }
    return g;
  }

  private makeDeadTree(rng: () => number): THREE.Object3D {
    const g    = new THREE.Group();
    const h    = 4 + rng() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), this.matBark);
    trunk.position.y = h / 2;
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    trunk.castShadow = true;
    g.add(trunk);
    const branches = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < branches; i++) {
      const bl = 1.2 + rng() * 2;
      const b  = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, bl, 5), this.matBark);
      b.rotation.z = (rng() - 0.5) * 1.2;
      b.rotation.y = rng() * Math.PI * 2;
      b.position.y = h * (0.6 + rng() * 0.35);
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  private makeMesa(rng: () => number): THREE.Object3D {
    // Flat-topped sandstone butte — background landmark
    const g = new THREE.Group();
    const w = 12 + rng() * 30;
    const h = 8  + rng() * 22;
    const d = 10 + rng() * 25;
    // Base (wider trapezoid look via two boxes)
    const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, h * 0.6, d * 1.2), this.matMesa);
    base.position.y = h * 0.3;
    base.castShadow = true; base.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), this.matMesa);
    top.position.y = h * 0.78;
    top.castShadow = true; top.receiveShadow = true;
    g.add(base, top);
    return g;
  }

  // ── Deterministic RNG from cell coords ────────────────────────────────────

  private cellRng(cx: number, cz: number): () => number {
    let s = Math.abs(cx * 73856093 ^ cz * 19349663) + 1;
    return () => {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  // ── Cell key ───────────────────────────────────────────────────────────────

  private key(cx: number, cz: number) { return `${cx},${cz}`; }

  // ── Spawn cell ────────────────────────────────────────────────────────────

  private spawnCell(
    cx: number, cz: number,
    heightFn: (x: number, z: number) => number
  ): void {
    const k = this.key(cx, cz);
    if (this.props.has(k)) return;

    const rng   = this.cellRng(cx, cz);
    const list: THREE.Object3D[] = [];

    // Skip cells too close to origin (spawn area)
    const wx = cx * this.CELL;
    const wz = cz * this.CELL;
    if (Math.abs(wx) < 20 && Math.abs(wz) < 20) { this.props.set(k, []); return; }

    // Noise-driven prop type
    const v    = this.noise.fbm(cx * 0.15, cz * 0.15, 2, 0.5, 2);
    const cnt  = 1 + Math.floor(rng() * 3);

    for (let i = 0; i < cnt; i++) {
      const ox  = (rng() - 0.5) * this.CELL * 0.8;
      const oz  = (rng() - 0.5) * this.CELL * 0.8;
      const x   = wx + ox;
      const z   = wz + oz;
      const y   = heightFn(x, z);

      let obj: THREE.Object3D;
      if      (v >  0.3)  obj = this.makeRock(rng);
      else if (v >  0.0)  obj = this.makeCactus(rng);
      else if (v > -0.2)  obj = this.makeShrub(rng);
      else if (v > -0.4)  obj = this.makeDeadTree(rng);
      else                obj = this.makeMesa(rng);

      obj.position.set(x, y, z);
      obj.rotation.y = rng() * Math.PI * 2;
      obj.scale.setScalar(0.7 + rng() * 0.7);
      this.scene.add(obj);
      list.push(obj);
    }

    this.props.set(k, list);
  }

  private despawnCell(k: string): void {
    const list = this.props.get(k);
    if (!list) return;
    list.forEach(obj => this.scene.remove(obj));
    this.props.delete(k);
  }

  // ── Update (streaming) ────────────────────────────────────────────────────

  update(
    playerPos: THREE.Vector3,
    heightFn: (x: number, z: number) => number
  ): void {
    const px = Math.round(playerPos.x / this.CELL);
    const pz = Math.round(playerPos.z / this.CELL);
    const R  = this.RADIUS;

    for (let x = px - R; x <= px + R; x++)
      for (let z = pz - R; z <= pz + R; z++)
        this.spawnCell(x, z, heightFn);

    this.props.forEach((_, k) => {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - px) > R + 1 || Math.abs(cz - pz) > R + 1)
        this.despawnCell(k);
    });
  }

  dispose(): void {
    this.props.forEach((list) => list.forEach(o => this.scene.remove(o)));
    this.props.clear();
    [this.matRock, this.matCactus, this.matShrub, this.matBark, this.matMesa]
      .forEach(m => m.dispose());
  }
}
