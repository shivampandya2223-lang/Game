/**
 * Vehicle System
 * Loads Buggy.glb with correct orientation, snappy arcade physics,
 * terrain-following suspension, and wheel animation.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Body, World, Sphere, Vec3 } from 'cannon-es';

export interface VehicleState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  speed   : number;
  isLoaded: boolean;
}

export class VehicleSystem {
  private scene : THREE.Scene;
  private world : World;
  private carBody: Body;
  private carMesh: THREE.Group;
  private isModelLoaded = false;

  // Wheel nodes found in the GLB
  private wheels     : THREE.Object3D[] = [];
  private frontWheels: THREE.Object3D[] = [];
  private wheelRotation = 0;

  // Driving state
  private acceleration = 0;
  private steering     = 0;
  private yaw          = 0;

  // Tuning
  private readonly MAX_SPEED      = 180;   // km/h
  private readonly ACCEL_FORCE    = 280;
  private readonly DECEL_FORCE    = 70;
  private readonly STEERING_SPEED = 2.8;
  private readonly STEERING_MAX   = 0.52;
  private readonly DRIFT_FACTOR   = 0.87;

  // Keys
  private keys: Record<string, boolean> = {};

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    this.carBody = new Body({
      mass          : 1,
      shape         : new Sphere(1.3),
      linearDamping : 0.30,
      angularDamping: 0.99,
    });
    this.carBody.position.set(0, 10, 0);
    world.addBody(this.carBody);

    this.carMesh = this.buildPlaceholder();
    scene.add(this.carMesh);

    this.loadGLB();
    this.hookInputs();
  }

  // ── Placeholder (shown while GLB loads) ──────────────────────────────────

  private buildPlaceholder(): THREE.Group {
    const g = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color    : 0xe05020,
      roughness: 0.5,
      metalness: 0.4,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 4.0), bodyMat);
    chassis.position.y = 0.65;
    chassis.castShadow = true;
    g.add(chassis);

    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.0), bodyMat);
    cab.position.set(0, 1.3, 0.2);
    cab.castShadow = true;
    g.add(cab);

    // Windshield
    const glassMat = new THREE.MeshStandardMaterial({
      color      : 0x88ccff,
      transparent: true,
      opacity    : 0.45,
      roughness  : 0.1,
      metalness  : 0.1,
    });
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), glassMat);
    wind.position.set(0, 1.35, 1.15);
    wind.rotation.x = 0.25;
    g.add(wind);

    // Wheels
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    const wPositions: [number, number, number][] = [
      [-1.15, 0, 1.3], [1.15, 0, 1.3],
      [-1.15, 0, -1.3], [1.15, 0, -1.3],
    ];
    wPositions.forEach(([x, y, z], i) => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 18), wMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wg.add(tire, rim);
      wg.position.set(x, y, z);
      g.add(wg);
      this.wheels.push(wg);
      if (i < 2) this.frontWheels.push(wg);
    });

    return g;
  }

  // ── GLB loader ────────────────────────────────────────────────────────────

  private loadGLB(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/Buggy.glb',
      (gltf) => {
        this.scene.remove(this.carMesh);
        this.wheels      = [];
        this.frontWheels = [];

        const model = gltf.scene;

        // Scale to ~4 units wide
        const box  = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.0 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);

        // Re-measure after scale
        box.setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);

        // Centre XZ, sit on ground
        model.position.set(-centre.x, -box.min.y, -centre.z);

        // ── Determine which way the model faces ──────────────────────────
        // We need the front of the car to face -Z (our forward direction).
        // Try to detect orientation from bounding box aspect ratio.
        // If the model is longer in Z than X it's already aligned; otherwise rotate.
        const needsRotation = size.x > size.z * 1.1;
        if (needsRotation) {
          model.rotation.y = Math.PI / 2;
          // Re-centre after rotation
          box.setFromObject(model);
          box.getCenter(centre);
          model.position.set(-centre.x, -box.min.y, -centre.z);
        }

        // Shadows & wheel harvest
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.castShadow    = true;
          child.receiveShadow = true;

          const n = child.name.toLowerCase();
          const isWheel =
            n.includes('wheel') || n.includes('tire') ||
            n.includes('tyre')  || n.includes('roda') ||
            n.includes('roue');
          if (isWheel) {
            this.wheels.push(child);
            if (
              n.includes('front') || n.includes('fl') ||
              n.includes('fr')    || n.includes('f_') ||
              n.includes('avant')
            ) {
              this.frontWheels.push(child);
            }
          }
        });

        this.carMesh = new THREE.Group();
        this.carMesh.add(model);
        this.scene.add(this.carMesh);
        this.isModelLoaded = true;
        console.log('✅ Buggy.glb loaded — wheels:', this.wheels.length,
                    '| front:', this.frontWheels.length,
                    '| rotated:', needsRotation);
      },
      undefined,
      () => {
        console.warn('⚠️  Could not load /Buggy.glb — using placeholder');
        this.isModelLoaded = true;
      }
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private hookInputs(): void {
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()]  = true;
      this.keys[e.code.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()]  = false;
      this.keys[e.code.toLowerCase()] = false;
    });
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(dt: number, terrainHeight: number): void {
    const fwd  = this.keys['w'] || this.keys['arrowup'];
    const back = this.keys['s'] || this.keys['arrowdown'];
    const left = this.keys['a'] || this.keys['arrowleft'];
    const rght = this.keys['d'] || this.keys['arrowright'];
    const hand = this.keys[' '];

    // ── Acceleration ──────────────────────────────────────────────────────
    if (fwd) {
      this.acceleration = Math.min(this.acceleration + this.ACCEL_FORCE * dt, 1);
    } else if (back) {
      this.acceleration = Math.max(this.acceleration - this.ACCEL_FORCE * dt * 0.6, -0.35);
    } else {
      this.acceleration *= (1 - this.DECEL_FORCE * dt * 0.05);
      if (Math.abs(this.acceleration) < 0.002) this.acceleration = 0;
    }

    // ── Steering ──────────────────────────────────────────────────────────
    if (left) {
      this.steering = Math.min(this.steering + this.STEERING_SPEED * dt, this.STEERING_MAX);
    } else if (rght) {
      this.steering = Math.max(this.steering - this.STEERING_SPEED * dt, -this.STEERING_MAX);
    } else {
      this.steering *= 0.80;
      if (Math.abs(this.steering) < 0.001) this.steering = 0;
    }

    // ── Yaw ───────────────────────────────────────────────────────────────
    const vel   = this.carBody.velocity as unknown as THREE.Vector3;
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2); // m/s

    if (speed > 0.5 && Math.abs(this.acceleration) > 0.01) {
      const driftMult = hand ? 2.2 : 1.0;
      const turnRate  = this.steering * Math.min(speed, 30) * 0.015 * driftMult;
      this.yaw += turnRate;
    }

    // ── Velocity in yaw direction ─────────────────────────────────────────
    const sinY        = Math.sin(this.yaw);
    const cosY        = Math.cos(this.yaw);
    const targetSpeed = this.acceleration * (this.MAX_SPEED / 3.6);

    const df   = hand ? this.DRIFT_FACTOR * 0.72 : this.DRIFT_FACTOR;
    const tVx  = targetSpeed * sinY * 0.13 + vel.x * (1 - 0.13);
    const tVz  = targetSpeed * cosY * 0.13 + vel.z * (1 - 0.13);

    const fwdVel     = tVx * sinY + tVz * cosY;
    const sideVel    = tVx * cosY - tVz * sinY;
    const dampedSide = sideVel * df;

    this.carBody.velocity = new Vec3(
      fwdVel * sinY + dampedSide * cosY,
      vel.y,
      fwdVel * cosY - dampedSide * sinY
    );

    // ── Floor clamp ───────────────────────────────────────────────────────
    const minY = terrainHeight + 0.9;
    if (this.carBody.position.y < minY) {
      (this.carBody.position as unknown as THREE.Vector3).y = minY;
      if (this.carBody.velocity.y < 0) this.carBody.velocity.y = 0;
    }

    // ── Sync mesh ─────────────────────────────────────────────────────────
    this.carMesh.position.copy(this.carBody.position as unknown as THREE.Vector3);
    this.carMesh.rotation.set(0, this.yaw, 0);

    // ── Wheels ────────────────────────────────────────────────────────────
    this.wheelRotation += speed * dt / 0.52;
    this.wheels.forEach(w => (w.rotation.x = this.wheelRotation));
    this.frontWheels.forEach(w => (w.rotation.y = this.steering * 0.85));
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getState(): VehicleState {
    const vel   = this.carBody.velocity as unknown as THREE.Vector3;
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2) * 3.6;
    return {
      position : new THREE.Vector3().copy(this.carBody.position as unknown as THREE.Vector3),
      rotation : new THREE.Euler(0, this.yaw, 0),
      velocity : new THREE.Vector3(vel.x, vel.y, vel.z),
      speed,
      isLoaded : this.isModelLoaded,
    };
  }

  getBody() { return this.carBody; }
  getMesh() { return this.carMesh; }

  dispose(): void {
    this.scene.remove(this.carMesh);
    this.world.removeBody(this.carBody);
  }
}
