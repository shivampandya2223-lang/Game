import { useBox } from '@react-three/cannon'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Group } from 'three'

interface CollectibleProps {
  position: [number, number, number]
  onCollect: () => void
  type?: 'coin' | 'star' | 'gem'
}

/**
 * Collectible Component
 * Items that player can collect by driving over them
 */
const Collectible = ({ position, onCollect, type = 'coin' }: CollectibleProps) => {
  const [collected, setCollected] = useState(false)
  const groupRef = useRef<Group>(null)
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    args: [0.5, 0.5, 0.5],
    sensor: true, // Trigger sensor - doesn't collide, just detects
  }))

  useFrame(() => {
    if (!collected && groupRef.current) {
      groupRef.current.rotation.y += 0.05
      groupRef.current.position.y += Math.sin(Date.now() * 0.001) * 0.002
    }
  })

  const handleCollision = () => {
    if (!collected) {
      setCollected(true)
      onCollect()
      // Hide after collection
      setTimeout(() => {
        if (groupRef.current) {
          groupRef.current.visible = false
        }
      }, 300)
    }
  }

  // Color mapping
  const colors: Record<string, string> = {
    coin: '#FFD700',
    star: '#FFA500',
    gem: '#00FF00',
  }

  if (collected) return null

  return (
    <group ref={groupRef} onClick={handleCollision}>
      <mesh position={position} ref={ref}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial
          color={colors[type]}
          emissive={colors[type]}
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Glow effect */}
      <mesh position={position}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshBasicMaterial color={colors[type]} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

export default Collectible
