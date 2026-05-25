/**
 * Camera System
 * Cinematic third-person follow — always behind the buggy, speed-based zoom,
 * subtle shake, and smooth look-ahead.
 */

import * as THREE from 'three';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;

  private pos    = new THREE.Vector3(0, 7, 14);
  private lookAt = new THREE.Vector3();

  // Shake
  private shakeIntensity = 0;
  private shakeOffset    = new THREE.Vector3();

  // Settings
  private readonly BASE_DIST  = 11.5;
  private readonly HEIGHT     = 5.2;
  private readonly SMOOTHNESS = 0.115;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    camera.fov  = 64;
    camera.near = 0.3;
    camera.far  = 2000;
    camera.updateProjectionMatrix();
    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(carPos: THREE.Vector3, carYaw: number, speedKmh: number): void {
    const speedFactor = Math.min(speedKmh / 160, 1);
    const dist   = this.BASE_DIST + speedFactor * 4.5;
    const height = this.HEIGHT   + speedFactor * 1.6;

    // ── Car forward direction: (sinY, 0, cosY) ────────────────────────────
    // Camera must go in the OPPOSITE direction (behind the car).
    const sinY = Math.sin(carYaw);
    const cosY = Math.cos(carYaw);

    const target = new THREE.Vector3(
      carPos.x - sinY * dist,   // BEHIND: negate forward
      carPos.y + height,
      carPos.z - cosY * dist    // BEHIND: negate forward
    );

    this.pos.lerp(target, this.SMOOTHNESS);

    // Clamp above terrain surface
    if (this.pos.y < carPos.y + 2.1) this.pos.y = carPos.y + 2.1;

    // ── Look-ahead: slightly in front of the car ──────────────────────────
    const lookTarget = new THREE.Vector3(
      carPos.x + sinY * 4.2,   // ahead of car
      carPos.y + 1.05,
      carPos.z + cosY * 4.2    // ahead of car
    );
    this.lookAt.lerp(lookTarget, this.SMOOTHNESS * 1.8);

    // ── Camera shake at high speed ────────────────────────────────────────
    this.shakeIntensity = speedFactor * 0.035;
    this.shakeOffset.set(
      (Math.random() - 0.5) * this.shakeIntensity,
      (Math.random() - 0.5) * this.shakeIntensity * 0.5,
      0
    );

    this.camera.position.copy(this.pos).add(this.shakeOffset);
    this.camera.lookAt(this.lookAt);
  }
}
