import { KeyboardControls, Environment } from '@react-three/drei'
import { useEffect } from 'react'
import Vehicle from './Vehicle'
import World from './World'
import Camera from './Camera'
import { useAudio } from '../hooks/useAudio'
import { useGameStore } from '../store/useGameStore'

// Define controls map
const controlsMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
]

/**
 * Experience Component
 * Main 3D scene with all game elements
 */
const Experience = () => {
  const { setEngineVolume } = useAudio()
  const speed = useGameStore((state) => state.speed)

  // Update engine sound based on vehicle speed
  useEffect(() => {
    setEngineVolume(speed)
  }, [speed, setEngineVolume])

  return (
    <KeyboardControls map={controlsMap}>
      {/* Environment and lighting */}
      <Environment preset="sunset" background />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[15, 15, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#87ceeb', 50, 200]} />

      {/* Game components */}
      <World />
      <Vehicle />
      <Camera />
    </KeyboardControls>
  )
}

export default Experience