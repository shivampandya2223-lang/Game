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
  growth : number;
  gravity: number;
  drag   : number;
  maxOpacity: number;
}

export class ParticleSystem {
  private scene    : THREE.Scene;
  private particles: Particle[] = [];
  private readonly MAX = 420;

  // Shared geometries
  private geoSphere: THREE.BufferGeometry;
  private geoFlat  : THREE.BufferGeometry;

  // Sand colour palette — warm desert tones
  private readonly DUST_COLOURS = [
    0xa86f35, 0x9b6a35, 0xc1904d, 0x72502b,
    0xb4874d, 0x8a5b2f, 0xd0a463,
  ];

  constructor(scene: THREE.Scene) {
    this.scene    = scene;
    this.geoSphere = new THREE.SphereGeometry(0.25, 5, 4);
    this.geoFlat   = new THREE.PlaneGeometry(1, 0.3);
  }

  // ── Dust cloud behind tyres ───────────────────────────────────────────────

  emitDust(pos: THREE.Vector3, vel: THREE.Vector3, yaw = 0, speedKmh = 0, count = 5): void {
    if (this.particles.length >= this.MAX) return;

    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const speedFactor = THREE.MathUtils.clamp(speedKmh / 120, 0, 1);

    for (let i = 0; i < count; i++) {
      const col = this.DUST_COLOURS[Math.floor(Math.random() * this.DUST_COLOURS.length)];
      const mat = new THREE.MeshStandardMaterial({
        color      : col,
        roughness  : 1,
        transparent: true,
        opacity    : 0.18 + speedFactor * 0.20,
        depthWrite : false,
      });

      const sideSign = i % 2 === 0 ? -1 : 1;
      const initScale = 0.13 + Math.random() * (0.22 + speedFactor * 0.20);
      const mesh = new THREE.Mesh(this.geoSphere, mat);
      mesh.scale.set(initScale * 1.4, initScale * 0.45, initScale);
      mesh.position.copy(pos)
        .addScaledVector(forward, -1.9 - Math.random() * 0.7)
        .addScaledVector(right, sideSign * (0.68 + Math.random() * 0.28))
        .add(new THREE.Vector3(0, 0.12 + Math.random() * 0.18, 0));

      const pVel = forward.clone().multiplyScalar(-(1.1 + speedFactor * 4.2))
        .addScaledVector(right, sideSign * (0.7 + Math.random() * 1.4))
        .addScaledVector(vel, -0.035)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.55 + Math.random() * (1.0 + speedFactor * 1.2),
          (Math.random() - 0.5) * 0.8
        ));

      this.scene.add(mesh);
      this.particles.push({
        mesh, vel: pVel, life: 0,
        maxLife: 0.45 + Math.random() * (0.35 + speedFactor * 0.28),
        initScale,
        growth: 0.85 + speedFactor * 1.15,
        gravity: 2.2,
        drag: 0.90,
        maxOpacity: 0.20 + speedFactor * 0.22,
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
        maxLife: 0.8 + Math.random() * 0.6,
        initScale,
        growth: 1.25,
        gravity: 2.8,
        drag: 0.92,
        maxOpacity: 0.20,
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
        growth: 0.5,
        gravity: 0.4,
        drag: 0.97,
        maxOpacity: 0.12,
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
      p.vel.y   -= p.gravity * dt;
      p.vel.x   *= p.drag;
      p.vel.z   *= p.drag;

      // Grow as it disperses
      const sc = p.initScale * (1 + progress * p.growth);
      p.mesh.scale.set(sc * 1.45, sc * 0.5, sc);

      // Fade out
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, (1 - progress) * (progress < 0.22 ? progress / 0.22 : 1) * p.maxOpacity);

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
