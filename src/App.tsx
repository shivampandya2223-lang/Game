import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/cannon'
import Experience from './components/Experience'
import MiniMap from './components/MiniMap'
import { useGameStore } from './store/useGameStore'
import './App.css'

function App() {
  const speed = useGameStore((state) => state.speed)
  const collectibles = useGameStore((state) => state.collectibles)
  const isMuted = useGameStore((state) => state.isMuted)
  const toggleMute = useGameStore((state) => state.toggleMute)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Physics broadphase="SAP" gravity={[0, -9.82, 0]}>
            <Experience />
          </Physics>
        </Suspense>
      </Canvas>

      {/* Top-Left UI - Instructions & Stats */}
      <div className="ui">
        <div className="instructions">
          <h2>🏁 3D Driving Game</h2>
          <div className="control-group">
            <p>⌨️ <strong>Controls:</strong></p>
            <p style={{ margin: '4px 0' }}>WASD / Arrow Keys = Drive</p>
          </div>
          <div className="stat-group">
            <p>⚡ <strong>Speed:</strong> {speed.toFixed(1)} m/s</p>
            <p>💎 <strong>Collectibles:</strong> {collectibles}</p>
          </div>
        </div>

        {/* Mute Button */}
        <button
          className="mute-btn"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Mini-Map */}
      <MiniMap />

      {/* Bottom Info */}
      <div className="footer-info">
        <p>💡 Tip: Collect items, drive on ramps, and explore the world!</p>
      </div>
    </div>
  )
}

export default App
