/**
 * Camera System
 * Smooth third-person follow camera with cinematic feel
 */

import * as THREE from 'three';

export class CameraSystem {
  private camera: THREE.PerspectiveCamera;
  private targetPosition = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  // Camera settings
  private distance = 25;
  private height = 8;
  private maxDistance = 35;
  private minDistance = 15;
  private smoothness = 0.08; // Lower = smoother
  private shakeAmount = 0;
  private shakeDecay = 0.95;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.fov = 60;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.near = 0.1;
    this.camera.far = 2000;
    this.camera.updateProjectionMatrix();

    this.currentPosition.copy(camera.position);
    this.currentLookAt.copy(new THREE.Vector3(0, 0, 0));

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(carPosition: THREE.Vector3, carRotation: THREE.Quaternion, carSpeed: number): void {
    // Get car's forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(carRotation);

    // Get car's right direction
    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(carRotation);

    // Calculate camera target position (behind and above the car)
    const backOffset = forward.clone().multiplyScalar(-this.distance);
    const upOffset = new THREE.Vector3(0, this.height, 0);

    // Add slight side offset for better perspective
    const sideOffset = right.clone().multiplyScalar(2);

    this.targetPosition.copy(carPosition);
    this.targetPosition.add(backOffset);
    this.targetPosition.add(upOffset);
    this.targetPosition.add(sideOffset);

    // Adjust distance based on speed (zoom out when going fast)
    const speedFactor = Math.min(carSpeed / 100, 1);
    const dynamicDistance = this.distance + speedFactor * 10;
    this.targetPosition.copy(carPosition);
    this.targetPosition.add(forward.clone().multiplyScalar(-dynamicDistance));
    this.targetPosition.add(upOffset);
    this.targetPosition.add(sideOffset);

    // Look at point slightly ahead of car
    this.targetLookAt.copy(carPosition);
    const lookAheadOffset = forward.clone().multiplyScalar(10);
    this.targetLookAt.add(lookAheadOffset);
    this.targetLookAt.y += 2;

    // Apply camera shake based on speed
    this.shakeAmount = Math.min(carSpeed * 0.0005, 0.5);

    // Smooth camera movement with easing
    this.currentPosition.lerp(this.targetPosition, this.smoothness);
    this.currentLookAt.lerp(this.targetLookAt, this.smoothness * 0.5);

    // Apply shake
    const shake = new THREE.Vector3(
      (Math.random() - 0.5) * this.shakeAmount,
      (Math.random() - 0.5) * this.shakeAmount,
      (Math.random() - 0.5) * this.shakeAmount
    );

    const finalPosition = this.currentPosition.clone().add(shake);
    this.camera.position.copy(finalPosition);
    this.camera.lookAt(this.currentLookAt);

    // Decay shake
    this.shakeAmount *= this.shakeDecay;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  setDistance(distance: number): void {
    this.distance = Math.max(this.minDistance, Math.min(distance, this.maxDistance));
  }

  setHeight(height: number): void {
    this.height = height;
  }

  setSmoothness(smoothness: number): void {
    this.smoothness = Math.max(0.01, Math.min(smoothness, 0.3));
  }
}
