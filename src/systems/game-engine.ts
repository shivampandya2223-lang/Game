/**
 * Game Engine
 * Orchestrates all systems; owns the Three.js renderer and Cannon physics world.
 */

import * as THREE from 'three';
import { World }              from 'cannon-es';
import { TerrainSystem }      from './terrain';
import { VehicleSystem }      from './vehicle';
import type { VehicleState }  from './vehicle';
import { LightingSystem }     from './lighting';
import type { LightingState } from './lighting';
import { CameraSystem }       from './camera';
import { ParticleSystem }     from './particles';
import { EnvironmentSystem }  from './environment';

export interface GameState {
  vehicle : VehicleState;
  lighting: LightingState;
  fps     : number;
}

export class GameEngine {
  private scene   : THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera  : THREE.PerspectiveCamera;
  private world   : World;

  private terrain    !: TerrainSystem;
  private vehicle    !: VehicleSystem;
  private lighting   !: LightingSystem;
  private cameraSystem!: CameraSystem;
  private particles  !: ParticleSystem;
  private environment!: EnvironmentSystem;

  private animId    : number | null = null;
  private isRunning = false;
  private lastTime  : number | null = null;

  // FPS counter
  private frameCount = 0;
  private fpsAccum   = 0;
  private currentFps = 60;

  // Particle throttle timers
  private dustTimer  = 0;
  private smokeTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    // ── Scene ──────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();

    // ── Renderer ───────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias      : true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // ── Camera ─────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.3,
      2000
    );
    this.camera.position.set(0, 20, 30);

    // ── Physics ────────────────────────────────────────────────────────────
    this.world = new World();
    this.world.gravity.set(0, -20, 0);
    this.world.defaultContactMaterial.friction    = 0.5;
    this.world.defaultContactMaterial.restitution = 0.05;
    this.world.broadphase.useBoundingBoxes = true;

    // ── Systems ────────────────────────────────────────────────────────────
    this.terrain      = new TerrainSystem(this.scene, this.world, 12345);
    this.vehicle      = new VehicleSystem(this.scene, this.world);
    this.lighting     = new LightingSystem(this.scene);
    this.cameraSystem = new CameraSystem(this.camera);
    this.particles    = new ParticleSystem(this.scene);
    this.environment  = new EnvironmentSystem(this.scene, 9999);

    // Start at golden afternoon
    this.lighting.setTimeOfDay(15);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = (now: number) => {
      const dt = Math.min((now - (this.lastTime ?? now)) / 1000, 0.033);
      this.lastTime = now;
      this.tick(dt);
      this.renderer.render(this.scene, this.camera);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    this.animId    = null;
    this.isRunning = false;
  }

  // ── Per-frame tick ────────────────────────────────────────────────────────

  private tick(dt: number): void {
    const vs = this.vehicle.getState();

    // Physics step
    this.world.step(1 / 60, dt, 3);

    // Terrain height under car
    const th = this.terrain.getTerrainHeightAt(vs.position.x, vs.position.z);

    // Systems update
    this.vehicle.update(dt, th);
    this.terrain.update(vs.position);
    this.environment.update(
      vs.position,
      (x, z) => this.terrain.getTerrainHeightAt(x, z)
    );
    this.lighting.update(dt);
    this.cameraSystem.update(vs.position, vs.rotation.y, vs.speed);
    this.particles.update(dt);

    // ── Dust cloud ────────────────────────────────────────────────────────
    this.dustTimer += dt;
    if (vs.speed > 10 && this.dustTimer > 0.06) {
      const dustPos = vs.position.clone().add(
        new THREE.Vector3(
          Math.sin(vs.rotation.y) * 2,
          0.25,
          Math.cos(vs.rotation.y) * 2
        )
      );
      const dustCount = Math.floor(Math.min(vs.speed / 25, 7));
      this.particles.emitDust(dustPos, vs.velocity, dustCount);
      this.dustTimer = 0;
    }

    // ── Tyre smoke at very high speed or drift ────────────────────────────
    this.smokeTimer += dt;
    if (vs.speed > 80 && this.smokeTimer > 0.12) {
      const smokePos = vs.position.clone().add(
        new THREE.Vector3(
          Math.sin(vs.rotation.y) * 1.5,
          0.1,
          Math.cos(vs.rotation.y) * 1.5
        )
      );
      this.particles.emitSmoke(smokePos, 2);
      this.smokeTimer = 0;
    }

    // ── Ambient wind wisps ────────────────────────────────────────────────
    if (Math.random() < 0.006) {
      this.particles.emitWindStreak(vs.position);
    }

    // ── FPS ───────────────────────────────────────────────────────────────
    this.frameCount++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 1) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsAccum   = 0;
    }
  }

  // ── Public accessors ───────────────────────────────────────────────────────

  getGameState(): GameState {
    return {
      vehicle : this.vehicle.getState(),
      lighting: this.lighting.getState(),
      fps     : this.currentFps,
    };
  }

  dispose(): void {
    this.stop();
    this.terrain.dispose();
    this.vehicle.dispose();
    this.lighting.dispose();
    this.particles.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
