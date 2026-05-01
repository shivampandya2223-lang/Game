/**
 * Particle System
 * Sand dust kicked up behind the buggy, drifting in the desert wind
 */

import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private readonly MAX = 600;

  // Shared geometry — one sphere, instanced per particle
  private geo: THREE.BufferGeometry;

  // Sand colour palette
  private readonly COLOURS = [0xd4a870, 0xc09050, 0xe0c090, 0xb87840, 0xddc080];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geo   = new THREE.SphereGeometry(0.22, 4, 4);
  }

  // ── Emit ─────────────────────────────────────────────────────────────────

  emitDust(pos: THREE.Vector3, vel: THREE.Vector3, count = 4): void {
    if (this.particles.length >= this.MAX) return;

    for (let i = 0; i < count; i++) {
      const col = this.COLOURS[Math.floor(Math.random() * this.COLOURS.length)];
      const mat = new THREE.MeshStandardMaterial({
        color      : col,
        roughness  : 1,
        transparent: true,
        opacity    : 0.55 + Math.random() * 0.3,
        depthWrite : false,
      });

      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.scale.setScalar(0.4 + Math.random() * 1.2);
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 2
      ));

      // Kick sideways + upward
      const pVel = new THREE.Vector3(
        vel.x * 0.2 + (Math.random() - 0.5) * 8,
        2 + Math.random() * 7,
        vel.z * 0.2 + (Math.random() - 0.5) * 8
      );

      this.scene.add(mesh);
      this.particles.push({ mesh, vel: pVel, life: 0, maxLife: 0.8 + Math.random() * 1.2 });
    }
  }

  // ── Wind streaks (ambient sand wisps) ─────────────────────────────────────

  emitWindStreak(origin: THREE.Vector3): void {
    if (this.particles.length >= this.MAX - 10) return;
    const count = 2;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xe0c890, transparent: true, opacity: 0.18, depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.scale.set(0.2, 0.2, 1.5 + Math.random() * 2);
      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 30,
        origin.y + 0.3 + Math.random() * 1.5,
        origin.z + (Math.random() - 0.5) * 30
      );
      const vel = new THREE.Vector3(3 + Math.random() * 4, 0.2, (Math.random() - 0.5) * 2);
      this.scene.add(mesh);
      this.particles.push({ mesh, vel, life: 0, maxLife: 1.5 + Math.random() * 1.5 });
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const progress = p.life / p.maxLife;

      // Move
      p.mesh.position.addScaledVector(p.vel, dt);

      // Gravity & drag
      p.vel.y   -= 4.5 * dt;
      p.vel.x   *= 0.97;
      p.vel.z   *= 0.97;

      // Scale up slightly as it disperses
      const sc = 1 + progress * 1.5;
      p.mesh.scale.setScalar(p.mesh.scale.x > 0.1 ? p.mesh.scale.x * (1 + dt * 0.4) : 0.1);

      // Fade
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (1 - progress) * 0.6);

      if (progress >= 1) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
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
    this.geo.dispose();
  }
}
