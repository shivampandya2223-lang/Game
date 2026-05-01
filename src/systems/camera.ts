/**
 * Camera System
 * Smooth third-person follow with speed-based zoom and slight lag
 */

import * as THREE from 'three';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;

  // Current smoothed values
  private pos    = new THREE.Vector3(0, 15, 30);
  private lookAt = new THREE.Vector3();

  // Settings
  private readonly BASE_DIST  = 20;
  private readonly HEIGHT     = 9;
  private readonly SMOOTHNESS = 0.06;  // lower = more lag / cinematic

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    camera.fov  = 65;
    camera.near = 0.3;
    camera.far  = 1800;
    camera.updateProjectionMatrix();
    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(carPos: THREE.Vector3, carYaw: number, speedKmh: number): void {
    // Dynamic distance — zoom out slightly at high speed
    const speedFactor = Math.min(speedKmh / 150, 1);
    const dist = this.BASE_DIST + speedFactor * 12;

    // Target position: directly behind the car, elevated
    const sinY = Math.sin(carYaw);
    const cosY = Math.cos(carYaw);
    const target = new THREE.Vector3(
      carPos.x + sinY * dist,
      carPos.y + this.HEIGHT + speedFactor * 3,
      carPos.z + cosY * dist
    );

    // Smooth follow
    this.pos.lerp(target, this.SMOOTHNESS);

    // Don't clip underground
    if (this.pos.y < carPos.y + 2) this.pos.y = carPos.y + 2;

    // Look slightly ahead of the car
    const lookTarget = new THREE.Vector3(
      carPos.x - sinY * 6,
      carPos.y + 1.5,
      carPos.z - cosY * 6
    );
    this.lookAt.lerp(lookTarget, this.SMOOTHNESS * 1.5);

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.lookAt);
  }
}
