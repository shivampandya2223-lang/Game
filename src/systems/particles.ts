/**
 * Particle System
 * Premium sand dust, tyre smoke, and ambient wind wisps.
 * Uses instanced rendering for performance.
 */

import * as THREE from 'three';

interface Particle {
  mesh   : THREE.Mesh;
  vel    : THREE.Vector3;
  life   : number;
  maxLife: number;
  initScale: number;
}

export class ParticleSystem {
  private scene    : THREE.Scene;
  private particles: Particle[] = [];
  private readonly MAX = 800;

  // Shared geometries
  private geoSphere: THREE.BufferGeometry;
  private geoFlat  : THREE.BufferGeometry;

  // Sand colour palette — warm desert tones
  private readonly DUST_COLOURS = [
    0xd4a870, 0xc09050, 0xe0c090, 0xb87840,
    0xddc080, 0xc8a060, 0xf0d0a0,
  ];

  constructor(scene: THREE.Scene) {
    this.scene    = scene;
    this.geoSphere = new THREE.SphereGeometry(0.25, 5, 4);
    this.geoFlat   = new THREE.PlaneGeometry(1, 0.3);
  }

  // ── Dust cloud behind tyres ───────────────────────────────────────────────

  emitDust(pos: THREE.Vector3, vel: THREE.Vector3, count = 5): void {
    if (this.particles.length >= this.MAX) return;

    for (let i = 0; i < count; i++) {
      const col = this.DUST_COLOURS[Math.floor(Math.random() * this.DUST_COLOURS.length)];
      const mat = new THREE.MeshStandardMaterial({
        color      : col,
        roughness  : 1,
        transparent: true,
        opacity    : 0.5 + Math.random() * 0.35,
        depthWrite : false,
      });

      const initScale = 0.5 + Math.random() * 1.4;
      const mesh = new THREE.Mesh(this.geoSphere, mat);
      mesh.scale.setScalar(initScale);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 0.6,
        (Math.random() - 0.5) * 2.5
      ));

      const pVel = new THREE.Vector3(
        vel.x * 0.15 + (Math.random() - 0.5) * 9,
        1.5 + Math.random() * 8,
        vel.z * 0.15 + (Math.random() - 0.5) * 9
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh, vel: pVel, life: 0,
        maxLife: 0.9 + Math.random() * 1.4,
        initScale,
      });
    }
  }

  // ── Tyre smoke at high speed / drift ─────────────────────────────────────

  emitSmoke(pos: THREE.Vector3, count = 3): void {
    if (this.particles.length >= this.MAX) return;

    for (let i = 0; i < count; i++) {
      const grey = 0.55 + Math.random() * 0.3;
      const mat  = new THREE.MeshStandardMaterial({
        color      : new THREE.Color(grey, grey, grey),
        transparent: true,
        opacity    : 0.35 + Math.random() * 0.2,
        depthWrite : false,
        roughness  : 1,
      });

      const initScale = 0.8 + Math.random() * 1.0;
      const mesh = new THREE.Mesh(this.geoSphere, mat);
      mesh.scale.setScalar(initScale);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.3 + Math.random() * 0.5,
        (Math.random() - 0.5) * 1.5
      ));

      const pVel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        3 + Math.random() * 5,
        (Math.random() - 0.5) * 3
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh, vel: pVel, life: 0,
        maxLife: 1.2 + Math.random() * 1.0,
        initScale,
      });
    }
  }

  // ── Ambient wind streaks ──────────────────────────────────────────────────

  emitWindStreak(origin: THREE.Vector3): void {
    if (this.particles.length >= this.MAX - 10) return;

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color      : 0xe8d090,
        transparent: true,
        opacity    : 0.12 + Math.random() * 0.1,
        depthWrite : false,
      });
      const mesh = new THREE.Mesh(this.geoFlat, mat);
      mesh.scale.set(1.5 + Math.random() * 3, 1, 1);
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 40,
        origin.y + 0.2 + Math.random() * 2,
        origin.z + (Math.random() - 0.5) * 40
      );
      mesh.rotation.y = Math.random() * Math.PI;

      const vel = new THREE.Vector3(
        4 + Math.random() * 5,
        0.1 + Math.random() * 0.3,
        (Math.random() - 0.5) * 2
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh, vel, life: 0,
        maxLife: 1.8 + Math.random() * 2.0,
        initScale: 1,
      });
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p        = this.particles[i];
      p.life        += dt;
      const progress = p.life / p.maxLife;

      p.mesh.position.addScaledVector(p.vel, dt);

      // Gravity + drag
      p.vel.y   -= 3.5 * dt;
      p.vel.x   *= 0.96;
      p.vel.z   *= 0.96;

      // Grow as it disperses
      const sc = p.initScale * (1 + progress * 2.5);
      p.mesh.scale.setScalar(sc);

      // Fade out
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, (1 - progress) * (progress < 0.3 ? progress / 0.3 : 1) * 0.65);

      if (progress >= 1) {
        this.scene.remove(p.mesh);
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];
    this.geoSphere.dispose();
    this.geoFlat.dispose();
  }
}
