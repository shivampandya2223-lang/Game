/**
 * Particle Effects System
 * Creates dust clouds and other visual effects
 */

import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  startOpacity: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.Material;
  private maxParticles = 1000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create particle geometry
    this.particleGeometry = new THREE.SphereGeometry(0.2, 4, 4);

    // Create particle material
    this.particleMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574,
      metalness: 0,
      roughness: 0.9,
      transparent: true,
    });
  }

  emitDust(position: THREE.Vector3, velocity: THREE.Vector3, count = 3): void {
    if (this.particles.length >= this.maxParticles) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const particleVelocity = velocity
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 15,
            (Math.random() - 0.5) * 10
          )
        );

      const particle: Particle = {
        mesh: new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone()),
        velocity: particleVelocity,
        life: 0,
        maxLife: 1 + Math.random() * 1,
        startOpacity: 0.6,
      };

      particle.mesh.position.copy(position);
      particle.mesh.scale.set(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5);
      particle.mesh.castShadow = false;
      particle.mesh.receiveShadow = false;

      this.scene.add(particle.mesh);
      this.particles.push(particle);
    }
  }

  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      particle.life += deltaTime;
      const progress = particle.life / particle.maxLife;

      // Update position
      particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

      // Apply gravity
      particle.velocity.y -= 9.8 * deltaTime;

      // Fade out
      const opacity = particle.startOpacity * (1 - progress);
      (particle.mesh.material as any).opacity = Math.max(0, opacity);

      // Remove dead particles
      if (progress >= 1) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.particles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];
    this.particleGeometry.dispose();
    (this.particleMaterial as THREE.Material).dispose();
  }
}
