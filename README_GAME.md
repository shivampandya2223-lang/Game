# 🏜️ High-Performance 3D Desert Driving Game

A premium, production-ready infinite desert driving experience built with Three.js, featuring procedural terrain generation, realistic physics, dynamic day-night cycles, and professional-grade visual effects.

## ✨ Features

### 🌍 Infinite Desert World
- **Procedurally Generated Terrain**: Seamless Perlin/Simplex noise-based terrain with natural sand dunes
- **Chunk-Based Loading/Unloading**: Infinite world with optimized memory management
- **Environmental Props**: Rocks, cacti, and shrubs strategically placed using noise functions
- **Dynamic Elevation**: Varied sand dune heights for immersive terrain exploration

### 🚗 Advanced Vehicle Physics
- **Custom Physics Engine**: Built on Cannon-es for realistic car behavior
- **Smooth Controls**:
  - Acceleration/Deceleration with momentum
  - Responsive steering with variable turning radius
  - Handbrake/Drift mechanics for sliding on sand
  - Suspension-like bounce effect
- **Realistic Movement**: Speed-based physics, friction on sand, drift feel

### 🌞 Dynamic Day-Night Cycle
- **24-Hour Time System**: Complete day-night transitions
- **Sky Color Transitions**:
  - Sunrise (6:00): Orange to blue transition
  - Noon (12:00): Bright clear sky
  - Sunset (18:00): Orange to purple transition
  - Night (00:00): Dark sky with faint moonlight
- **Adaptive Lighting**:
  - Sun directional light that moves across the sky
  - Ambient light that adjusts with time of day
  - Fog color matching sky for depth perception
  - Smooth interpolation between time periods

### 💡 Premium Lighting & Visuals
- **Professional Rendering**:
  - PCF Soft Shadows for realistic shadow quality
  - ACESFilmicToneMapping for cinematic color grading
  - Physically-based materials (MeshStandardMaterial)
  - Proper gamma correction and color spaces
- **Visual Effects**:
  - Dust particle system triggered by vehicle movement
  - Smooth fade effects for particles
  - Fog layering for depth and atmosphere
  - Material variations on environmental props

### 🎥 Cinematic Camera System
- **Third-Person Follow Camera**:
  - Smooth interpolation with configurable responsiveness
  - Dynamic zoom based on vehicle speed
  - Camera shake intensity scaled to velocity
  - Positioned behind and slightly above the vehicle
  - Look-ahead for immersive driving experience

### ⚡ Performance Optimization
- **60 FPS Target**: Optimized for smooth gameplay
- **Instancing Ready**: Prepared for repeated geometry
- **LOD Support**: Framework for level-of-detail systems
- **Frustum Culling**: Terrain chunks only render when visible
- **Efficient Particle System**: Pooled particles with lifecycle management
- **Texture Optimization**: Canvas-based sand textures with repeat wrapping

### 🎮 Responsive Controls
```
W / Arrow Up → Accelerate
S / Arrow Down → Brake/Reverse
A / Arrow Left → Turn Left
D / Arrow Right → Turn Right
Space → Handbrake/Drift
```

### 📊 In-Game HUD
- **Speed Indicator**: Real-time vehicle speed display (km/h)
- **Time of Day**: Clock showing current time with period (Morning/Afternoon/Evening/Night)
- **FPS Counter**: Real-time performance monitoring
- **Controls Guide**: On-screen control reference

## 🏗️ Project Architecture

```
src/
├── systems/
│   ├── game-engine.ts          # Main orchestrator and game loop
│   ├── terrain.ts              # Procedural terrain generation & chunking
│   ├── vehicle.ts              # Car physics and movement
│   ├── lighting.ts             # Day-night cycle system
│   ├── camera.ts               # Third-person follow camera
│   ├── particles.ts            # Dust effect system
│   └── environment.ts          # Environmental decorations
├── utils/
│   └── noise.ts                # Simplex noise implementation
├── components/
│   ├── GameUI.tsx              # React UI wrapper
│   └── GameUI.css              # HUD styling
├── App.tsx                     # Main app component
└── main.tsx                    # Entry point
```

## 🛠️ Technology Stack

- **Three.js** (v0.184): 3D graphics library
- **Cannon-es** (v0.20): Lightweight physics engine
- **React** (v19): UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
cd Game

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5174/`

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## 📈 Performance Characteristics

- **Target FPS**: 60 fps on modern hardware
- **Memory Optimization**: Chunk-based terrain with intelligent unloading
- **Draw Calls**: Optimized material usage and batching-ready
- **Asset Size**: Procedural generation (no large mesh files)

## 🎯 Key Implementation Details

### Terrain System
- Generates infinite procedural terrain using Simplex noise
- Implements multi-octave Fractional Brownian Motion (FBM) for natural variation
- Chunks load/unload based on player distance
- Collision bodies for physics interactions

### Vehicle Physics
- Custom implementation on Cannon-es sphere body
- Velocity interpolation for smooth movement
- Quaternion-based rotation for realistic steering
- Drift factor adjustment for sandy terrain feel

### Lighting System
- Interpolates between 9 predefined time-of-day colors
- Moves sun position along orbital path
- Adjusts ambient light intensity based on time
- Synchronizes fog, background, and directional light

### Camera System
- Uses vector3 lerp for smooth following
- Applies camera shake proportional to speed
- Dynamically adjusts distance based on velocity
- Implements look-ahead for immersive driving

## 🔧 Customization

### Adjust Camera Feel
```typescript
// In CameraSystem constructor
this.distance = 25;        // Distance behind car
this.height = 8;           // Height above car
this.smoothness = 0.08;    // Lower = smoother
```

### Modify Vehicle Physics
```typescript
// In VehicleSystem constructor
this.maxSpeed = 150;       // Maximum velocity
this.accelerationForce = 200;  // Acceleration rate
this.steeringMax = 0.5;    // Maximum steering angle
```

### Change Time Speed
```typescript
// In GameEngine initialization
this.lightingSystem.setTimeSpeed(0.01);  // Faster time progression
```

### Adjust Terrain Parameters
```typescript
// In TerrainSystem constructor
this.loadDistance = 256;   // When to load chunks
this.unloadDistance = 384; // When to unload chunks
this.chunkResolution = 64; // Terrain detail level
```

## 🎨 Customization Examples

### Change Car Color
Modify the car material color in `src/systems/vehicle.ts`:
```typescript
const carMaterial = new THREE.MeshStandardMaterial({
  color: 0x0066ff,  // Change to desired color
  metalness: 0.6,
  roughness: 0.4,
});
```

### Modify Terrain Colors
Adjust the sand material in `src/systems/terrain.ts`:
```typescript
this.terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0xffaa00,  // Different sand color
  metalness: 0.0,
  roughness: 0.9,
});
```

### Customize Day/Night Colors
Edit the color palette in `src/systems/lighting.ts`:
```typescript
private skyColors = [
  { time: 12, color: new THREE.Color(0xff00ff) },  // Magenta noon
  // ... more colors
];
```

## 📱 Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires WebGL 2.0 support

## 🐛 Troubleshooting

### Black Screen
- Check browser console for Three.js errors
- Ensure WebGL is supported and enabled
- Try clearing browser cache

### Low FPS
- Reduce `chunkResolution` in TerrainSystem for lower terrain detail
- Lower `loadDistance` to render fewer terrain chunks
- Disable particle effects or reduce `maxParticles`

### Physics Issues
- Verify terrain collision bodies are being created
- Check vehicle altitude above terrain in update loop

## 🚀 Future Enhancements

- [ ] Vehicle damage and destruction physics
- [ ] Weather systems (sandstorms, rain)
- [ ] Multiple vehicle types with different physics
- [ ] Collectible items and objectives
- [ ] Multiplayer networking
- [ ] Mobile touch controls
- [ ] VR support
- [ ] Advanced shadow cascades
- [ ] Post-processing effects (bloom, motion blur)
- [ ] Sound design and audio engine

## 📄 License

This project is provided as-is for educational and portfolio purposes.

## 🙏 Credits

Built with:
- Three.js - 3D Graphics Library
- Cannon-es - Physics Engine
- React - UI Library
- Vite - Build Tool

---

**Enjoy driving through the infinite desert!** 🏜️
