/**
 * Vehicle System
 * Loads Buggy.glb with correct orientation, snappy arcade physics,
 * terrain-following suspension, and wheel animation.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Body, World, Sphere } from 'cannon-es';

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
  private position = new THREE.Vector3(9, 0, 14);
  private velocity = new THREE.Vector3();
  private visualY = 0;
  private visualPitch = 0;
  private visualRoll = 0;
  private hasRideInitialized = false;
  private headlightRig: THREE.Group;
  private headlights: THREE.SpotLight[] = [];
  private headlightGlowMats: THREE.MeshBasicMaterial[] = [];

  // Wheel nodes found in the GLB
  private wheels     : THREE.Object3D[] = [];
  private frontWheels: THREE.Object3D[] = [];
  private wheelRotation = 0;

  // Driving state
  private steering     = 0;
  private yaw          = 0;
  private speed        = 0;

  // Tuning
  private readonly MAX_SPEED      = 180;   // km/h
  private readonly MAX_REVERSE    = 42;    // km/h
  private readonly ACCEL_RATE     = 24;    // m/s^2
  private readonly BRAKE_RATE     = 34;    // m/s^2
  private readonly COAST_DRAG     = 7.5;   // m/s^2
  private readonly STEERING_SPEED = 2.8;
  private readonly STEERING_MAX   = 0.52;
  private readonly COLLIDER_RADIUS = 1.3;
  private readonly GROUND_CLEARANCE = 0.0;
  private readonly WHEEL_BASE = 2.35;
  private readonly TRACK_WIDTH = 1.7;

  // Keys
  private keys: Record<string, boolean> = {};

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    this.carBody = new Body({
      mass          : 0,
      shape         : new Sphere(this.COLLIDER_RADIUS),
      linearDamping : 0.30,
      angularDamping: 0.99,
    });
    this.carBody.collisionResponse = false;
    this.carBody.position.set(this.position.x, this.COLLIDER_RADIUS, this.position.z);
    world.addBody(this.carBody);

    this.carMesh = this.buildPlaceholder();
    this.carMesh.position.copy(this.position);
    this.headlightRig = this.buildHeadlights();
    this.carMesh.add(this.headlightRig);
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

        // Scale to ~4 units long after final orientation.
        const box  = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.0 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);

        // ── Determine which way the model faces ──────────────────────────
        // We need the front of the car to face -Z (our forward direction).
        // Try to detect orientation from bounding box aspect ratio.
        // If the model is longer in Z than X it's already aligned; otherwise rotate.
        const needsRotation = size.x > size.z * 1.1;
        if (needsRotation) {
          model.rotation.y = Math.PI / 2;
        }

        // Centre XZ and put the final rotated/scaled model exactly on y=0.
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);
        box.setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        model.position.set(-centre.x, -box.min.y, -centre.z);

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
        this.carMesh.add(this.headlightRig);
        this.carMesh.position.copy(this.position);
        this.carMesh.rotation.set(this.visualPitch, this.yaw, this.visualRoll, 'YXZ');
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

  private buildHeadlights(): THREE.Group {
    const rig = new THREE.Group();
    const lampMat = new THREE.MeshBasicMaterial({
      color      : 0xffe2a0,
      transparent: true,
      opacity    : 0,
      depthWrite : false,
    });

    const lampPositions: [number, number, number][] = [
      [-0.38, 0.58, 1.92],
      [ 0.38, 0.58, 1.92],
    ];

    lampPositions.forEach(([x, y, z]) => {
      const light = new THREE.SpotLight(0xffdca0, 0, 78, 0.34, 0.62, 1.25);
      light.position.set(x, y, z);
      light.castShadow = false;
      light.target.position.set(x, 0.18, 15);
      rig.add(light, light.target);
      this.headlights.push(light);

      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), lampMat.clone());
      glow.position.set(x, y, z + 0.04);
      rig.add(glow);
      this.headlightGlowMats.push(glow.material as THREE.MeshBasicMaterial);
    });

    return rig;
  }

  setHeadlightPower(nightFactor: number): void {
    const power = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(nightFactor, 0, 1), 0, 1);
    this.headlights.forEach((light) => {
      light.intensity = power * 18;
      light.distance = 58 + power * 22;
    });
    this.headlightGlowMats.forEach((mat) => {
      mat.opacity = power * 0.95;
    });
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

  private approach(current: number, target: number, step: number): number {
    if (current < target) return Math.min(current + step, target);
    if (current > target) return Math.max(current - step, target);
    return target;
  }

  private sampleRide(
    getTerrainHeightAt: (x: number, z: number) => number
  ): { height: number; pitch: number; roll: number } {
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const rightX = cosY;
    const rightZ = -sinY;
    const halfBase = this.WHEEL_BASE * 0.5;
    const halfTrack = this.TRACK_WIDTH * 0.5;

    const frontLeftH = getTerrainHeightAt(
      this.position.x + sinY * halfBase - rightX * halfTrack,
      this.position.z + cosY * halfBase - rightZ * halfTrack
    );
    const frontRightH = getTerrainHeightAt(
      this.position.x + sinY * halfBase + rightX * halfTrack,
      this.position.z + cosY * halfBase + rightZ * halfTrack
    );
    const rearLeftH = getTerrainHeightAt(
      this.position.x - sinY * halfBase - rightX * halfTrack,
      this.position.z - cosY * halfBase - rightZ * halfTrack
    );
    const rearRightH = getTerrainHeightAt(
      this.position.x - sinY * halfBase + rightX * halfTrack,
      this.position.z - cosY * halfBase + rightZ * halfTrack
    );
    const centerH = getTerrainHeightAt(this.position.x, this.position.z);

    const frontH = (frontLeftH + frontRightH) * 0.5;
    const rearH = (rearLeftH + rearRightH) * 0.5;
    const leftH = (frontLeftH + rearLeftH) * 0.5;
    const rightH = (frontRightH + rearRightH) * 0.5;
    const heights = [frontLeftH, frontRightH, rearLeftH, rearRightH];
    const pitch = THREE.MathUtils.clamp(Math.atan2(rearH - frontH, this.WHEEL_BASE), -0.38, 0.38);
    const roll = THREE.MathUtils.clamp(Math.atan2(leftH - rightH, this.TRACK_WIDTH), -0.34, 0.34);
    const contactPoints = [
      new THREE.Vector3(-halfTrack, 0, halfBase),
      new THREE.Vector3( halfTrack, 0, halfBase),
      new THREE.Vector3(-halfTrack, 0, -halfBase),
      new THREE.Vector3( halfTrack, 0, -halfBase),
    ];
    const contactEuler = new THREE.Euler(pitch, 0, roll, 'YXZ');
    const fittedHeight = contactPoints.reduce((sum, point, index) => {
      return sum + heights[index] - point.applyEuler(contactEuler).y;
    }, 0) / contactPoints.length;

    return {
      height: Math.max(fittedHeight, centerH - 0.12) + this.GROUND_CLEARANCE,
      pitch,
      roll,
    };
  }

  update(
    dt: number,
    terrainHeight: number,
    getTerrainHeightAt?: (x: number, z: number) => number
  ): void {
    const fwd  = this.keys['w'] || this.keys['arrowup'];
    const back = this.keys['s'] || this.keys['arrowdown'];
    const left = this.keys['a'] || this.keys['arrowleft'];
    const rght = this.keys['d'] || this.keys['arrowright'];
    const hand = this.keys[' '];

    const maxForward = this.MAX_SPEED / 3.6;
    const maxReverse = -this.MAX_REVERSE / 3.6;

    // ── Speed ─────────────────────────────────────────────────────────────
    if (fwd && !back) {
      this.speed = this.approach(this.speed, maxForward, this.ACCEL_RATE * dt);
    } else if (back && !fwd) {
      const rate = this.speed > 1 ? this.BRAKE_RATE : this.ACCEL_RATE * 0.55;
      this.speed = this.approach(this.speed, maxReverse, rate * dt);
    } else {
      this.speed = this.approach(this.speed, 0, this.COAST_DRAG * dt);
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

    // ── Steering / yaw ────────────────────────────────────────────────────
    const absSpeed = Math.abs(this.speed);
    if (absSpeed > 0.15) {
      const speedFactor = THREE.MathUtils.clamp(absSpeed / 24, 0.2, 1.0);
      const reverseSign = this.speed >= 0 ? 1 : -1;
      const driftMult = hand ? 1.65 : 1.0;
      this.yaw += this.steering * speedFactor * driftMult * reverseSign * dt * 1.85;
    }

    // ── Integrate across the desert ───────────────────────────────────────
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.x += sinY * this.speed * dt;
    this.position.z += cosY * this.speed * dt;

    const ride = getTerrainHeightAt
      ? this.sampleRide(getTerrainHeightAt)
      : { height: terrainHeight + this.GROUND_CLEARANCE, pitch: 0, roll: 0 };

    if (!this.hasRideInitialized) {
      this.visualY = ride.height;
      this.visualPitch = ride.pitch;
      this.visualRoll = ride.roll;
      this.hasRideInitialized = true;
    } else {
      const heightT = 1 - Math.exp(-dt * 22);
      const leanT = 1 - Math.exp(-dt * 10);
      this.visualY += (ride.height - this.visualY) * heightT;
      this.visualPitch += (ride.pitch - this.visualPitch) * leanT;
      this.visualRoll  += (ride.roll - this.visualRoll) * leanT;
    }
    this.position.y = this.visualY;

    this.velocity.set(
      (this.position.x - prevX) / Math.max(dt, 0.0001),
      0,
      (this.position.z - prevZ) / Math.max(dt, 0.0001)
    );

    // ── Sync mesh ─────────────────────────────────────────────────────────
    this.carMesh.position.copy(this.position);
    this.carMesh.rotation.set(this.visualPitch, this.yaw, this.visualRoll, 'YXZ');
    this.carBody.position.set(this.position.x, this.position.y + this.COLLIDER_RADIUS, this.position.z);
    this.carBody.velocity.set(this.velocity.x, 0, this.velocity.z);

    // ── Wheels ────────────────────────────────────────────────────────────
    this.wheelRotation += this.speed * dt / 0.52;
    this.wheels.forEach(w => (w.rotation.x = this.wheelRotation));
    this.frontWheels.forEach(w => (w.rotation.y = this.steering * 0.85));
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getState(): VehicleState {
    const speed = Math.abs(this.speed) * 3.6;
    return {
      position : this.position.clone(),
      rotation : new THREE.Euler(0, this.yaw, 0),
      velocity : this.velocity.clone(),
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
