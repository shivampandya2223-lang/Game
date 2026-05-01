# 🚗 3D Driving Game

A playful, production-level 3D web-based driving game built with React, Vite, React Three Fiber, and physics simulation. Inspired by interactive 3D experiences but with unique world design and gameplay mechanics.

## ✨ Features

### 🎮 Gameplay
- **Vehicle Control**: Realistic car physics with acceleration, braking, steering, and drag
- **Collectibles**: Coins, stars, and gems scattered throughout the world
- **Interactive World**: Ramps, obstacles, buildings, trees, and dynamic terrain
- **Speed Tracking**: Real-time speed display (0-30 m/s max)
- **Visual Feedback**: Speed-based engine sounds and particle effects

### 🎥 Camera System
- Smooth third-person follow camera with interpolation
- Collision detection to prevent clipping
- Dynamic distance adjustment
- Cinematic positioning

### 🎨 Visual Design
- Stylized low-poly aesthetic
- Soft sunset HDRI environment
- Dynamic shadows and lighting
- Color-coded world elements
- Fog for depth perception

### 🎵 Audio System
- Engine sound with dynamic pitch and volume
- Mute/unmute toggle
- Background music (placeholder ready)
- Collision sound effects (extensible)

### 📱 UI & UX
- On-screen speed and collectibles counter
- Mini-map with real-time vehicle tracking
- Mute button
- Help text and tips
- Responsive design

### 🗺️ World Elements
- **Terrain**: Large explorable grass landscape
- **Road**: Marked driving surface with center line
- **Buildings**: Detailed structures with roofs
- **Obstacles**: Interactive physics objects
- **Ramps**: Jump opportunities
- **Trees**: Environmental decoration with foliage
- **Collectibles**: 5 items to find and collect

## 🛠️ Tech Stack

- **React 18** with TypeScript for type safety
- **Vite** for fast HMR and building
- **React Three Fiber** for 3D rendering abstraction
- **@react-three/drei** for 3D utilities (Environment, KeyboardControls)
- **@react-three/cannon** for physics simulation (Cannon.js wrapper)
- **Zustand** for lightweight state management
- **Three.js** for low-level 3D graphics
- **Howler.js** for cross-browser audio

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Modern browser with WebGL support

### Installation

```bash
# Clone repository (or extract project)
cd Game

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Building for Production

```bash
npm run build

# Output in dist/ directory
npm run preview  # Preview build locally
```

## 🎮 Gameplay Controls

| Input | Action |
|-------|--------|
| **W / ↑** | Accelerate forward |
| **S / ↓** | Brake/Reverse |
| **A / ←** | Turn left |
| **D / →** | Turn right |
| **🔊 Button** | Toggle audio mute |

## 📁 Project Structure

```
src/
├── components/
│   ├── Experience.tsx      # Main 3D scene wrapper
│   ├── Vehicle.tsx         # Car physics & rendering
│   ├── World.tsx           # Terrain, buildings, obstacles
│   ├── Camera.tsx          # Follow camera system
│   ├── Collectible.tsx     # Pickup items
│   ├── TriggerZone.tsx     # Interactive zones
│   ├── MiniMap.tsx         # Top-down map view
│   └── MiniMap.css         # Map styles
├── hooks/
│   ├── useControls.ts      # Keyboard input mapping
│   ├── useAudio.ts         # Audio management (Howler.js)
│   └── useMobileControls.ts # Touch controls (extensible)
├── store/
│   └── useGameStore.ts     # Global state (Zustand)
├── App.tsx                 # Main React component
├── App.css                 # Global styles
└── main.tsx                # Entry point
```

## 🔧 Key Systems Explained

### Vehicle Physics (Vehicle.tsx)

**Advanced physics implementation with:**
- Acceleration force based on velocity
- Drag coefficient for air resistance
- Smooth deceleration when not accelerating
- Directional forces based on vehicle rotation
- Torque for realistic steering

```typescript
// Physics parameters (tunable)
const MAX_SPEED = 30
const ACCELERATION = 100
const DECELERATION = 50
const TURN_SPEED = 3.5
const DRAG_COEFFICIENT = 0.02
```

**Vehicle Model:**
- Main chassis (red box)
- Roof section
- Windows (transparent)
- 4 wheels with rotation tracking

### Camera System (Camera.tsx)

- Follows vehicle with 0.08 lerp factor for smoothness
- Maintains distance of 10 units behind, 5 units above
- Prevents clipping through terrain (Y > 1)
- Looks slightly upward for better visibility
- Distance limits for safety

### Collectibles (Collectible.tsx)

- Physics sensor (no collision, just detection)
- Auto-rotating for visual appeal
- Golden glow effect
- Types: coin (gold), star (orange), gem (green)
- Callback on collection for score tracking

### Audio System (useAudio.ts)

- Howler.js for cross-browser support
- Dynamic engine pitch (0.8x - 1.5x) based on speed
- Volume increases with velocity
- Mutable via store

### Mini-Map (MiniMap.tsx)

- 200x200px canvas-based rendering
- Top-down world view
- Red indicator for vehicle position
- Grid overlay for reference
- Real-time updates from game store

### State Management (useGameStore.ts)

Zustand store with:
- Vehicle position and speed
- Collectibles counter
- Mute toggle
- Efficient subscriptions for performance

## ⚡ Performance Optimizations

1. **Rendering:**
   - Efficient geometry reuse
   - Shadow mapping (2048x2048)
   - Fog for culling far objects
   - Optimized material properties

2. **Physics:**
   - SAP (Sweep and Prune) broadphase
   - Static bodies for environment
   - Sensor colliders for triggers

3. **Updates:**
   - Selective state subscriptions in components
   - Efficient camera lerp with delta time
   - RAF-based rendering loop

## 🎨 Customization

### Adjust Physics
Edit `Vehicle.tsx` constants:
```typescript
const MAX_SPEED = 30        // Max velocity in m/s
const ACCELERATION = 100    // Force applied per frame
const TURN_SPEED = 3.5      // Steering responsiveness
const DRAG_COEFFICIENT = 0.02  // Air resistance
```

### Modify World
- Add objects in `World.tsx`
- Use `useBox`, `usePlane`, `useCylinder` for physics
- Add materials with Three.js `MeshStandardMaterial`

### Add Collectibles
```typescript
<Collectible
  position={[x, y, z]}
  type="coin" | "star" | "gem"
  onCollect={() => addCollectible()}
/>
```

### Customize Colors
Edit material colors in `World.tsx`:
```typescript
<meshStandardMaterial color="#2d5016" roughness={0.8} />
```

## 🔊 Audio Setup

Currently uses placeholder audio (data URIs). For production:

1. Create audio files (MP3/OGG):
   - `engine.mp3` - Engine loop (looped)
   - `collision.mp3` - Impact sound
   - `collectible.mp3` - Pickup sound
   - `music.mp3` - Background music (looped)

2. Update `useAudio.ts`:
```typescript
engine: new Howl({
  src: ['./sounds/engine.mp3'],  // Point to your file
  loop: true,
  volume: 0.5,
}),
```

3. Host on CDN or bundle with assets

## 📱 Mobile Support (Extensible)

`useMobileControls.ts` hook ready for implementation:
- Virtual joystick detection
- Touch event handling
- Screen-relative controls

To integrate, add to Experience.tsx:
```typescript
const { controls } = useMobileControls()
```

## 🧪 Testing & Debugging

### Enable Visual Debug
- Uncomment mesh `visible={false}` in `TriggerZone.tsx` to see trigger zones
- Add `wireframe: true` to materials to see geometry

### Performance Monitoring
- Open browser DevTools → Performance
- Record frame rate, draw calls, physics computation

### Physics Debugging
Add Cannon.js debug renderer (optional):
```bash
npm install cannon-es
```

## 🚀 Future Enhancements

- [ ] Mobile touch controls integration
- [ ] Additional vehicle types (truck, bike, etc.)
- [ ] Track/race mode with checkpoints
- [ ] Multiplayer support via WebSockets
- [ ] Advanced lighting (normal maps, PBR)
- [ ] Particle effects for collisions
- [ ] Weather system (rain, fog)
- [ ] Physics-based rope/cloth
- [ ] Level editor
- [ ] Leaderboard system
- [ ] VR support

## 📊 Performance Targets

- **FPS**: 60fps on mid-range devices
- **Physics**: 1000+ rigidbodies support
- **Draw Calls**: < 100 per frame
- **Memory**: < 100MB

## 🐛 Known Limitations

- Placeholder audio (use real audio files for production)
- Single-player only (multiplayer extensible)
- Limited to 150x150 world (expandable)
- No procedural generation (add later)

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Credits

- Inspired by Bruno Simon's portfolio interactive experiences
- Built with React Three Fiber ecosystem
- Physics powered by Cannon.js

---

**Made with ❤️ by a creative technologist**

Questions? Check the source code comments for detailed explanations of each system!
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
