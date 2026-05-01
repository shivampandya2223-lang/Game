/**
 * Vehicle System
 * Loads Buggy.glb and drives it with snappy arcade physics
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Body, World, Sphere, Vec3 } from 'cannon-es';

export interface VehicleState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  speed: number;
  isLoaded: boolean;
}

export class VehicleSystem {
  private scene: THREE.Scene;
  private world: World;
  private carBody: Body;
  private carMesh: THREE.Group;
  private isModelLoaded = false;

  // Wheel nodes found in the GLB
  private wheels: THREE.Object3D[] = [];
  private frontWheels: THREE.Object3D[] = [];
  private wheelRotation = 0;

  // Driving state
  private acceleration = 0;
  private steering    = 0;
  private yaw         = 0; // degrees, for independent yaw control

  // Tuning
  private readonly MAX_SPEED         = 200;  // km/h
  private readonly ACCEL_FORCE       = 300;
  private readonly DECEL_FORCE       = 80;
  private readonly STEERING_SPEED    = 3.0;
  private readonly STEERING_MAX      = 0.55;
  private readonly DRIFT_FACTOR      = 0.88;

  // Keys
  private keys: Record<string, boolean> = {};

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    // Physics: a rolling sphere so the car slides naturally over dunes
    this.carBody = new Body({
      mass: 1,
      shape: new Sphere(1.3),
      linearDamping: 0.28,
      angularDamping: 0.99, // we control rotation ourselves
    });
    this.carBody.position.set(0, 10, 0);
    world.addBody(this.carBody);

    // Placeholder shown while GLB loads
    this.carMesh = this.buildPlaceholder();
    scene.add(this.carMesh);

    this.loadGLB();
    this.hookInputs();
  }

  // ── Placeholder ───────────────────────────────────────────────────────────

  private buildPlaceholder(): THREE.Group {
    const g = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3.5), mat);
    body.position.y = 0.6; body.castShadow = true;
    g.add(body);

    const wmat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    [[-1.05, 0, 1.1],[1.05, 0, 1.1],[-1.05, 0,-1.1],[1.05, 0,-1.1]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.4,14), wmat);
      w.rotation.z = Math.PI/2; w.position.set(x,y,z); w.castShadow = true;
      g.add(w); this.wheels.push(w);
    });
    return g;
  }

  // ── GLB loader ────────────────────────────────────────────────────────────

  private loadGLB(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/Buggy.glb',
      (gltf) => {
        // Tear down placeholder
        this.scene.remove(this.carMesh);
        this.wheels = [];
        this.frontWheels = [];

        const model = gltf.scene;

        // ── Fit to ~4 units wide ─────────────────────────────────────────────
        const box  = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.0 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);

        // Sit on ground, centred in XZ
        box.setFromObject(model);
        const centre = new THREE.Vector3();
        box.getCenter(centre);
        model.position.set(-centre.x, -box.min.y - 0.1, -centre.z);

        // ── Shadows & wheel harvest ──────────────────────────────────────────
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.castShadow = true;
          child.receiveShadow = true;

          const n = child.name.toLowerCase();
          const isWheel = n.includes('wheel') || n.includes('tire') || n.includes('tyre') || n.includes('roda');
          if (isWheel) {
            this.wheels.push(child);
            if (n.includes('front') || n.includes('fl') || n.includes('fr') || n.includes('f_')) {
              this.frontWheels.push(child);
            }
          }
        });

        this.carMesh = new THREE.Group();
        this.carMesh.add(model);
        this.scene.add(this.carMesh);
        this.isModelLoaded = true;
        console.log('✅ Buggy.glb loaded! Wheels found:', this.wheels.length);
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
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
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

    // ── Acceleration ─────────────────────────────────────────────────────────
    if (fwd) {
      this.acceleration = Math.min(this.acceleration + this.ACCEL_FORCE * dt, 1);
    } else if (back) {
      this.acceleration = Math.max(this.acceleration - this.ACCEL_FORCE * dt * 0.6, -0.35);
    } else {
      this.acceleration *= (1 - this.DECEL_FORCE * dt * 0.05);
      if (Math.abs(this.acceleration) < 0.002) this.acceleration = 0;
    }

    // ── Steering ─────────────────────────────────────────────────────────────
    if (left) {
      this.steering = Math.min(this.steering + this.STEERING_SPEED * dt, this.STEERING_MAX);
    } else if (rght) {
      this.steering = Math.max(this.steering - this.STEERING_SPEED * dt, -this.STEERING_MAX);
    } else {
      this.steering *= 0.82;
      if (Math.abs(this.steering) < 0.001) this.steering = 0;
    }

    // ── Yaw (independent rotation — no physics torque needed) ────────────────
    const vel = this.carBody.velocity as unknown as THREE.Vector3;
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);          // m/s

    if (speed > 0.5 && Math.abs(this.acceleration) > 0.01) {
      const driftMult = hand ? 2.0 : 1.0;
      const turnRate  = this.steering * Math.min(speed, 35) * 0.014 * driftMult;
      this.yaw += turnRate;
    }

    // ── Apply velocity in yaw direction ──────────────────────────────────────
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const targetSpeed = this.acceleration * (this.MAX_SPEED / 3.6); // → m/s

    // Blend forward + sideways drift
    const df = hand ? this.DRIFT_FACTOR * 0.75 : this.DRIFT_FACTOR;
    const tVx = targetSpeed * sinY * 0.12 + vel.x * (1 - 0.12);
    const tVz = targetSpeed * cosY * 0.12 + vel.z * (1 - 0.12);

    // Dampen sideways slip unless handbraking
    const fwdVel  = tVx * sinY + tVz * cosY;
    const sideVel = tVx * cosY - tVz * sinY;
    const dampedSide = sideVel * df;

    this.carBody.velocity = new Vec3(
      fwdVel * sinY + dampedSide * cosY,
      vel.y,
      fwdVel * cosY - dampedSide * sinY
    );

    // ── Floor clamp ──────────────────────────────────────────────────────────
    const minY = terrainHeight + 0.9;
    if (this.carBody.position.y < minY) {
      (this.carBody.position as unknown as THREE.Vector3).y = minY;
      if (this.carBody.velocity.y < 0) this.carBody.velocity.y = 0;
    }

    // ── Sync mesh ─────────────────────────────────────────────────────────────
    this.carMesh.position.copy(this.carBody.position as unknown as THREE.Vector3);
    // Apply our explicit yaw only (no physics rotation bleeding in)
    this.carMesh.rotation.set(0, this.yaw, 0);

    // ── Wheels ───────────────────────────────────────────────────────────────
    this.wheelRotation += speed * dt / 0.55;
    this.wheels.forEach(w => (w.rotation.x = this.wheelRotation));
    this.frontWheels.forEach(w => (w.rotation.y = this.steering * 0.9));
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  getState(): VehicleState {
    const vel   = this.carBody.velocity as unknown as THREE.Vector3;
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2) * 3.6; // km/h
    return {
      position  : new THREE.Vector3().copy(this.carBody.position as unknown as THREE.Vector3),
      rotation  : new THREE.Euler(0, this.yaw, 0),
      velocity  : new THREE.Vector3(vel.x, vel.y, vel.z),
      speed,
      isLoaded  : this.isModelLoaded,
    };
  }

  getBody()  { return this.carBody; }
  getMesh()  { return this.carMesh; }

  dispose(): void {
    this.scene.remove(this.carMesh);
    this.world.removeBody(this.carBody);
  }
}
