/**
 * Vehicle System
 * Handles car physics, movement, and control
 */

import * as THREE from 'three';
import { Body, World, Sphere, Vec3 } from 'cannon-es';

export interface VehicleState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  speed: number;
}

export class VehicleSystem {
  private scene: THREE.Scene;
  private world: World;
  private carBody: Body;
  private carMesh: THREE.Group;
  
  // Movement properties
  private acceleration = 0;
  private steering = 0;
  private maxSpeed = 150;
  private accelerationForce = 200;
  private decelerationForce = 50;
  private steeringSpeed = 3;
  private steeringMax = 0.5;
  private driftFactor = 0.92;

  // Input states
  private keys: { [key: string]: boolean } = {};

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    // Create car body (physics)
    const shape = new Sphere(1.5);
    this.carBody = new Body({
      mass: 1,
      shape,
      linearDamping: 0.2,
      angularDamping: 0.5,
    });
    this.carBody.position.set(0, 10, 0);
    world.addBody(this.carBody);

    // Create car mesh
    this.carMesh = this.createCarMesh();
    this.carMesh.position.copy(this.carBody.position as any);
    scene.add(this.carMesh);

    // Setup input listeners
    this.setupInputListeners();
  }

  private createCarMesh(): THREE.Group {
    const group = new THREE.Group();

    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 4.5);
    const carMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      metalness: 0.6,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeometry, carMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 0.6;
    group.add(body);

    // Cabin
    const cabinGeometry = new THREE.BoxGeometry(1.6, 0.8, 1.5);
    const cabin = new THREE.Mesh(cabinGeometry, carMaterial);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    cabin.position.set(0, 1.4, -0.5);
    group.add(cabin);

    // Windows
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    // Front windows
    const frontWindowGeometry = new THREE.BoxGeometry(1.4, 0.5, 0.1);
    const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
    frontWindow.position.set(0, 1.5, 0.2);
    group.add(frontWindow);

    // Wheels
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.8,
    });

    const wheelPositions = [
      { x: -0.9, z: 1.2 },
      { x: 0.9, z: 1.2 },
      { x: -0.9, z: -1.2 },
      { x: 0.9, z: -1.2 },
    ];

    wheelPositions.forEach((pos) => {
      const wheelGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16);
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.6, pos.z);
      group.add(wheel);
    });

    // Bumper details
    const bumperGeometry = new THREE.BoxGeometry(2.2, 0.3, 0.3);
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.6,
    });
    const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    frontBumper.position.set(0, 0.4, 2.3);
    frontBumper.castShadow = true;
    group.add(frontBumper);

    return group;
  }

  private setupInputListeners(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code.toLowerCase()] = false;
    });
  }

  update(deltaTime: number, terrainHeight: number): void {
    // Handle input
    const w = this.keys['w'] || this.keys['arrowup'];
    const s = this.keys['s'] || this.keys['arrowdown'];
    const a = this.keys['a'] || this.keys['arrowleft'];
    const d = this.keys['d'] || this.keys['arrowright'];
    const space = this.keys[' '];

    // Acceleration/Deceleration
    if (w) {
      this.acceleration = Math.min(this.acceleration + this.accelerationForce * deltaTime, 1);
    } else if (s) {
      this.acceleration = Math.max(this.acceleration - this.accelerationForce * deltaTime, -0.5);
    } else {
      this.acceleration *= this.decelerationForce * deltaTime;
    }

    // Steering
    if (a) {
      this.steering = Math.min(this.steering + this.steeringSpeed * deltaTime, this.steeringMax);
    } else if (d) {
      this.steering = Math.max(this.steering - this.steeringSpeed * deltaTime, -this.steeringMax);
    } else {
      this.steering *= 0.9;
    }

    // Get current forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.carBody.quaternion as any);

    // Get right direction
    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(this.carBody.quaternion as any);

    // Calculate velocity target
    const velocityTarget = forward.multiplyScalar(this.acceleration * this.maxSpeed);
    const currentVel = this.carBody.velocity as any as THREE.Vector3;

    // Smooth velocity interpolation
    const targetVel = new THREE.Vector3(
      velocityTarget.x * 0.1 + currentVel.x * 0.9,
      currentVel.y,
      velocityTarget.z * 0.1 + currentVel.z * 0.9
    );

    // Apply drift effect (handbrake)
    if (space) {
      const sidewaysVel = right.clone().multiplyScalar(
        currentVel.dot(right) * (1 - this.driftFactor)
      );
      targetVel.add(sidewaysVel.multiplyScalar(0.5));
    }

    this.carBody.velocity = new Vec3(targetVel.x, currentVel.y, targetVel.z);

    // Rotation (steering)
    const rotationAxis = new THREE.Vector3(0, 1, 0);
    const speed = currentVel.length();
    if (speed > 1) {
      const rotationAmount = this.steering * speed * 0.01 * deltaTime;
      const quat = new THREE.Quaternion();
      quat.setFromAxisAngle(rotationAxis, rotationAmount);
      const newQuat = new THREE.Quaternion().setFromEuler(
        this.carMesh.rotation
      );
      newQuat.multiplyQuaternions(quat, newQuat);
      this.carBody.quaternion = newQuat as any;
    }

    // Keep car above terrain
    const minHeight = terrainHeight + 0.8;
    if (this.carBody.position.y < minHeight) {
      this.carBody.position.y = minHeight;
      this.carBody.velocity.y = 0;
    }

    // Update mesh position and rotation
    this.carMesh.position.copy(this.carBody.position as any);
    this.carMesh.quaternion.copy(this.carBody.quaternion as any);

    // Lean effect during steering
    this.carMesh.rotation.z = this.steering * 0.3;
  }

  getState(): VehicleState {
    const velocity = this.carBody.velocity as any as THREE.Vector3;
    const speed = velocity.length();

    return {
      position: new THREE.Vector3().copy(this.carBody.position as any),
      rotation: new THREE.Euler().setFromQuaternion(this.carBody.quaternion as any),
      velocity,
      speed,
    };
  }

  getMesh(): THREE.Group {
    return this.carMesh;
  }

  getBody(): Body {
    return this.carBody;
  }

  dispose(): void {
    this.scene.remove(this.carMesh);
    this.world.removeBody(this.carBody);
  }
}
