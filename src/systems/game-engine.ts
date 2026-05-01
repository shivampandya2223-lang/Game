/**
 * Game Engine
 * Main game loop and system orchestration
 */

import * as THREE from 'three';
import { World } from 'cannon-es';
import { TerrainSystem } from './terrain';
import { VehicleSystem } from './vehicle';
import type { VehicleState } from './vehicle';
import { LightingSystem } from './lighting';
import type { LightingState } from './lighting';
import { CameraSystem } from './camera';
import { ParticleSystem } from './particles';
import { EnvironmentSystem } from './environment';

export interface GameState {
  vehicle: VehicleState;
  lighting: LightingState;
  fps: number;
}

export class GameEngine {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  
  // Game systems
  private terrainSystem!: TerrainSystem;
  private vehicleSystem!: VehicleSystem;
  private lightingSystem!: LightingSystem;
  private cameraSystem!: CameraSystem;
  private particleSystem!: ParticleSystem;
  private environmentSystem!: EnvironmentSystem;

  // Performance tracking
  private frameCount = 0;
  private fpsUpdateTime = 0;
  private currentFps = 60;
  private lastDustEmission = 0;

  // Animation loop
  private animationId: number | null = null;
  private isRunning = false;

  constructor(canvas: HTMLCanvasElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 10, 30);

    // Physics world
    this.world = new World();
    this.world.gravity.set(0, -9.8, 0);
    this.world.defaultContactMaterial.friction = 0.3;

    // Initialize systems
    this.initializeSystems();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private initializeSystems(): void {
    this.terrainSystem = new TerrainSystem(this.scene, this.world, 12345);
    this.vehicleSystem = new VehicleSystem(this.scene, this.world);
    this.lightingSystem = new LightingSystem(this.scene);
    this.cameraSystem = new CameraSystem(this.camera);
    this.particleSystem = new ParticleSystem(this.scene);
    this.environmentSystem = new EnvironmentSystem(this.scene, 12345);

    // Set initial lighting time
    this.lightingSystem.setTimeOfDay(12);
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private updatePhysics(deltaTime: number): void {
    // Cap delta time to prevent large jumps
    const clampedDeltaTime = Math.min(deltaTime, 0.016);
    this.world.step(1 / 60, clampedDeltaTime, 3);
  }

  private emitDustEffects(vehicleState: VehicleState): void {
    this.lastDustEmission += vehicleState.speed * 0.001;

    if (this.lastDustEmission > 0.1 && vehicleState.speed > 5) {
      this.particleSystem.emitDust(
        vehicleState.position,
        vehicleState.velocity,
        Math.floor(vehicleState.speed / 30)
      );
      this.lastDustEmission = 0;
    }
  }

  update(): void {
    const now = performance.now();
    const deltaTime = Math.min((now - (this.lastUpdateTime || now)) / 1000, 0.033);
    this.lastUpdateTime = now;

    // Update systems
    const vehicleState = this.vehicleSystem.getState();
    const terrainHeight = this.terrainSystem.getTerrainHeightAt(
      vehicleState.position.x,
      vehicleState.position.z
    );

    // Vehicle update
    this.vehicleSystem.update(deltaTime, terrainHeight);

    // Physics update
    this.updatePhysics(deltaTime);

    // Terrain update (chunking)
    this.terrainSystem.update(vehicleState.position);

    // Environment update (props)
    this.environmentSystem.update(
      vehicleState.position,
      (x, z) => this.terrainSystem.getTerrainHeightAt(x, z)
    );

    // Lighting update
    this.lightingSystem.update(deltaTime);

    // Camera update
    this.cameraSystem.update(
      vehicleState.position,
      this.vehicleSystem.getBody().quaternion as any,
      vehicleState.speed
    );

    // Particles update
    this.particleSystem.update(deltaTime);

    // Emit dust effects
    this.emitDustEffects(vehicleState);

    // FPS counter
    this.frameCount++;
    this.fpsUpdateTime += deltaTime;
    if (this.fpsUpdateTime >= 1) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = 0;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private lastUpdateTime: number | null = null;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const gameLoop = () => {
      this.update();
      this.render();
      this.animationId = requestAnimationFrame(gameLoop);
    };

    this.animationId = requestAnimationFrame(gameLoop);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isRunning = false;
  }

  getGameState(): GameState {
    return {
      vehicle: this.vehicleSystem.getState(),
      lighting: this.lightingSystem.getState(),
      fps: this.currentFps,
    };
  }

  dispose(): void {
    this.stop();
    this.terrainSystem.dispose();
    this.vehicleSystem.dispose();
    this.lightingSystem.dispose();
    this.particleSystem.dispose();
    this.environmentSystem.dispose();
    this.renderer.dispose();
  }
}
