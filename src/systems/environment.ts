/**
 * Environment System
 * Rich desert props: layered sandstone mesas, saguaro cacti, rock clusters,
 * bleached bones, dry riverbeds, and distant mountain silhouettes.
 * All streamed around the player with deterministic placement.
 */

import * as THREE from 'three';
import { SimplexNoise } from '../utils/noise';

export class EnvironmentSystem {
  private scene: THREE.Scene;
  private noise: SimplexNoise;
  private props: Map<string, THREE.Object3D[]> = new Map();

  private readonly CELL   = 48;
  private readonly RADIUS = 4;

  // Shared materials
  private matRock    : THREE.MeshStandardMaterial;
  private matRockDark: THREE.MeshStandardMaterial;
  private matCactus  : THREE.MeshStandardMaterial;
  private matCactusD : THREE.MeshStandardMaterial;  // darker cactus variant
  private matShrub   : THREE.MeshStandardMaterial;
  private matBark    : THREE.MeshStandardMaterial;
  private matMesa    : THREE.MeshStandardMaterial;
  private matMesaTop : THREE.MeshStandardMaterial;
  private matBone    : THREE.MeshStandardMaterial;
  private matGravel  : THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, seed = 0) {
    this.scene = scene;
    this.noise = new SimplexNoise(seed);

    this.matRock     = new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 0.95, metalness: 0.0 });
    this.matRockDark = new THREE.MeshStandardMaterial({ color: 0x6a5040, roughness: 0.98, metalness: 0.0 });
    this.matCactus   = new THREE.MeshStandardMaterial({ color: 0x3d7a28, roughness: 0.85, metalness: 0.0 });
    this.matCactusD  = new THREE.MeshStandardMaterial({ color: 0x2a5a18, roughness: 0.90, metalness: 0.0 });
    this.matShrub    = new THREE.MeshStandardMaterial({ color: 0x7a6a30, roughness: 1.0,  metalness: 0.0 });
    this.matBark     = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 1.0,  metalness: 0.0 });
    this.matMesa     = new THREE.MeshStandardMaterial({ color: 0xb87040, roughness: 0.92, metalness: 0.0 });
    this.matMesaTop  = new THREE.MeshStandardMaterial({ color: 0xd09060, roughness: 0.88, metalness: 0.0 });
    this.matBone     = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.85, metalness: 0.0 });
    this.matGravel   = new THREE.MeshStandardMaterial({ color: 0xa08060, roughness: 1.0,  metalness: 0.0 });
  }

  // ── Prop factories ────────────────────────────────────────────────────────

  /** Organic rock cluster — warped icosahedra */
  private makeRock(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const n = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const r   = 0.6 + rng() * 3.0;
      const geo = new THREE.IcosahedronGeometry(r, 2);
      const pos = geo.attributes.position.array as Float32Array;
      for (let j = 0; j < pos.length; j += 3) {
        pos[j]     += (rng() - 0.5) * r * 0.4;
        pos[j + 1] += (rng() - 0.5) * r * 0.3;
        pos[j + 2] += (rng() - 0.5) * r * 0.4;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      const mat  = rng() > 0.4 ? this.matRock : this.matRockDark;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((rng() - 0.5) * 3, r * 0.55, (rng() - 0.5) * 3);
      mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      mesh.scale.y = 0.6 + rng() * 0.5;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /** Saguaro cactus with arms and subtle ribbing */
  private makeCactus(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const h = 4 + rng() * 6;
    const r = 0.28 + rng() * 0.12;

    // Main stem — slightly tapered
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.85, r, h, 10),
      rng() > 0.3 ? this.matCactus : this.matCactusD
    );
    stem.position.y = h / 2;
    stem.castShadow = true;
    g.add(stem);

    // Spine bumps (ribbing effect)
    for (let s = 0; s < 6; s++) {
      const sy = h * (0.1 + s * 0.14);
      const bump = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.9, r * 0.08, 4, 10),
        this.matCactus
      );
      bump.position.y = sy;
      bump.rotation.x = Math.PI / 2;
      g.add(bump);
    }

    // Arms
    const arms = Math.floor(rng() * 3);
    for (let i = 0; i < arms; i++) {
      const ah  = 1.5 + rng() * 2.5;
      const arm = new THREE.Group();

      // Horizontal segment
      const hSeg = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.65, r * 0.7, 1.4, 8),
        this.matCactus
      );
      hSeg.rotation.z = Math.PI / 2;
      hSeg.position.x = 0.7;

      // Vertical segment
      const vSeg = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.6, r * 0.65, ah, 8),
        this.matCactus
      );
      vSeg.position.set(1.4, ah / 2, 0);

      arm.add(hSeg, vSeg);
      arm.rotation.y = (i / arms) * Math.PI * 2 + rng() * 0.8;
      arm.position.y = h * (0.45 + rng() * 0.35);
      arm.castShadow = true;
      g.add(arm);
    }
    return g;
  }

  /** Desert shrub — low, spreading */
  private makeShrub(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const r    = 0.25 + rng() * 0.55;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(r, 6, 4),
        this.matShrub
      );
      ball.scale.set(1.2 + rng() * 0.4, 0.45 + rng() * 0.2, 1.2 + rng() * 0.4);
      ball.position.set(
        (rng() - 0.5) * 1.8,
        r * 0.35,
        (rng() - 0.5) * 1.8
      );
      ball.castShadow = true;
      g.add(ball);
    }
    return g;
  }

  /** Bleached dead tree */
  private makeDeadTree(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const h = 5 + rng() * 6;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.26, h, 7),
      this.matBark
    );
    trunk.position.y = h / 2;
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    trunk.castShadow = true;
    g.add(trunk);

    const branches = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < branches; i++) {
      const bl = 1.0 + rng() * 2.5;
      const b  = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.12, bl, 5),
        this.matBark
      );
      b.rotation.z = (rng() - 0.5) * 1.4;
      b.rotation.y = rng() * Math.PI * 2;
      b.position.y = h * (0.55 + rng() * 0.38);
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  /** Layered sandstone mesa — the hero landmark */
  private makeMesa(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const w = 15 + rng() * 40;
    const h = 10 + rng() * 28;
    const d = 12 + rng() * 35;

    // Layers — each slightly narrower and lighter
    const layers = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < layers; i++) {
      const t    = i / (layers - 1);
      const lw   = w * (1.3 - t * 0.35);
      const ld   = d * (1.3 - t * 0.35);
      const lh   = h / layers * (0.8 + rng() * 0.4);
      const ly   = i * (h / layers);

      // Slightly warp each layer for natural look
      const geo  = new THREE.BoxGeometry(lw, lh, ld);
      const pos  = geo.attributes.position.array as Float32Array;
      for (let j = 0; j < pos.length; j += 3) {
        if (pos[j + 1] > 0) { // top face only
          pos[j]     += (rng() - 0.5) * lw * 0.06;
          pos[j + 2] += (rng() - 0.5) * ld * 0.06;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();

      const mat  = i === layers - 1 ? this.matMesaTop : this.matMesa;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = ly + lh / 2;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /** Scattered gravel patch */
  private makeGravelPatch(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const n = 8 + Math.floor(rng() * 12);
    for (let i = 0; i < n; i++) {
      const r    = 0.1 + rng() * 0.35;
      const geo  = new THREE.IcosahedronGeometry(r, 0);
      const mesh = new THREE.Mesh(geo, this.matGravel);
      mesh.position.set(
        (rng() - 0.5) * 4,
        r * 0.3,
        (rng() - 0.5) * 4
      );
      mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      mesh.scale.y = 0.4 + rng() * 0.3;
      mesh.castShadow = true;
      g.add(mesh);
    }
    return g;
  }

  /** Bleached animal bones — atmospheric detail */
  private makeBones(rng: () => number): THREE.Object3D {
    const g = new THREE.Group();
    const n = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const l    = 0.4 + rng() * 1.2;
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, l, 5),
        this.matBone
      );
      bone.position.set((rng() - 0.5) * 2, 0.05, (rng() - 0.5) * 2);
      bone.rotation.set(
        (rng() - 0.5) * 0.4,
        rng() * Math.PI * 2,
        (rng() - 0.5) * 0.3
      );
      bone.castShadow = true;
      g.add(bone);
    }
    return g;
  }

  // ── Deterministic RNG ─────────────────────────────────────────────────────

  private cellRng(cx: number, cz: number): () => number {
    let s = Math.abs(cx * 73856093 ^ cz * 19349663) + 1;
    return () => {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  private key(cx: number, cz: number) { return `${cx},${cz}`; }

  // ── Spawn cell ────────────────────────────────────────────────────────────

  private spawnCell(
    cx: number, cz: number,
    heightFn: (x: number, z: number) => number
  ): void {
    const k = this.key(cx, cz);
    if (this.props.has(k)) return;

    const rng  = this.cellRng(cx, cz);
    const list : THREE.Object3D[] = [];
    const wx   = cx * this.CELL;
    const wz   = cz * this.CELL;

    // Clear zone around spawn
    if (Math.abs(wx) < 25 && Math.abs(wz) < 25) {
      this.props.set(k, []);
      return;
    }

    // Noise value drives prop type distribution
    const v   = this.noise.fbm(cx * 0.12, cz * 0.12, 2, 0.5, 2);
    const cnt = 1 + Math.floor(rng() * 4);

    for (let i = 0; i < cnt; i++) {
      const ox = (rng() - 0.5) * this.CELL * 0.85;
      const oz = (rng() - 0.5) * this.CELL * 0.85;
      const x  = wx + ox;
      const z  = wz + oz;
      const y  = heightFn(x, z);

      let obj: THREE.Object3D;

      if      (v >  0.45) obj = this.makeMesa(rng);
      else if (v >  0.25) obj = this.makeRock(rng);
      else if (v >  0.05) obj = this.makeCactus(rng);
      else if (v > -0.10) obj = this.makeShrub(rng);
      else if (v > -0.25) obj = this.makeDeadTree(rng);
      else if (v > -0.40) obj = this.makeGravelPatch(rng);
      else                obj = this.makeBones(rng);

      obj.position.set(x, y, z);
      obj.rotation.y = rng() * Math.PI * 2;
      obj.scale.setScalar(0.65 + rng() * 0.75);
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

  // ── Update ────────────────────────────────────────────────────────────────

  update(
    playerPos: THREE.Vector3,
    heightFn : (x: number, z: number) => number
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
    this.props.forEach(list => list.forEach(o => this.scene.remove(o)));
    this.props.clear();
    [
      this.matRock, this.matRockDark, this.matCactus, this.matCactusD,
      this.matShrub, this.matBark, this.matMesa, this.matMesaTop,
      this.matBone, this.matGravel,
    ].forEach(m => m.dispose());
  }
}
