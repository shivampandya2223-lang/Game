import { useBox, usePlane, useCylinder } from '@react-three/cannon'
import Collectible from './Collectible'
import { useGameStore } from '../store/useGameStore'

/**
 * World Component
 * Builds the 3D environment with terrain, buildings, obstacles, and collectibles
 * Modular and scalable design for easy expansion
 */
const World = () => {
  const addCollectible = useGameStore((state) => state.addCollectible)

  // ===== GROUND =====
  const [groundRef] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 0.8, restitution: 0.1 },
  }))

  // ===== ROAD =====
  const [roadRef] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0.01, 0],
    material: { friction: 0.9, restitution: 0.05 },
  }))

  // ===== OBSTACLES =====
  const [box1Ref] = useBox(() => ({
    position: [5, 1, -5],
    args: [2, 2, 2],
    material: { friction: 0.5, restitution: 0.6 },
  }))

  const [box2Ref] = useBox(() => ({
    position: [-5, 1, -10],
    args: [1, 3, 1],
    material: { friction: 0.5, restitution: 0.6 },
  }))

  // ===== BUILDINGS =====
  const [building1Ref] = useBox(() => ({
    position: [10, 2, -20],
    args: [4, 4, 4],
  }))

  const [building2Ref] = useBox(() => ({
    position: [-10, 1.5, -25],
    args: [3, 3, 3],
  }))

  // ===== TREES =====
  const [tree1Ref] = useCylinder(() => ({
    position: [8, 1, -15],
    args: [0.5, 0.5, 2],
  }))

  const [tree2Ref] = useCylinder(() => ({
    position: [-8, 1, -30],
    args: [0.5, 0.5, 2],
  }))

  const [tree3Ref] = useCylinder(() => ({
    position: [15, 1, -5],
    args: [0.5, 0.5, 2],
  }))

  const [tree4Ref] = useCylinder(() => ({
    position: [-15, 1, -35],
    args: [0.5, 0.5, 2],
  }))

  return (
    <>
      {/* ===== TERRAIN ===== */}
      <mesh ref={groundRef} receiveShadow>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#2d5016" roughness={0.8} />
      </mesh>

      {/* ===== ROAD ===== */}
      <mesh ref={roadRef} receiveShadow position={[0, 0.01, 0]}>
        <planeGeometry args={[12, 150]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.6} />
      </mesh>

      {/* Road center line */}
      <mesh position={[0, 0.02, 0]}>
        <planeGeometry args={[0.2, 150]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} />
      </mesh>

      {/* ===== OBSTACLES ===== */}
      <mesh ref={box1Ref} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.4} roughness={0.6} />
      </mesh>

      <mesh ref={box2Ref} castShadow>
        <boxGeometry args={[1, 3, 1]} />
        <meshStandardMaterial color="#f97316" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* ===== RAMP ===== */}
      <mesh position={[0, 0.5, -15]} rotation={[0.3, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 1, 5]} />
        <meshStandardMaterial color="#7c3aed" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* ===== BUILDINGS ===== */}
      <mesh ref={building1Ref} castShadow>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>

      {/* Building roof */}
      <mesh position={[10, 4.5, -20]} castShadow>
        <coneGeometry args={[2.5, 2, 4]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>

      <mesh ref={building2Ref} castShadow>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color="#eab308" />
      </mesh>

      {/* ===== TREES ===== */}
      <mesh ref={tree1Ref} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      {/* Tree foliage */}
      <mesh position={[8, 2.5, -15]} castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      <mesh ref={tree2Ref} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      <mesh position={[-8, 2.5, -30]} castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      <mesh ref={tree3Ref} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      <mesh position={[15, 2.5, -5]} castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      <mesh ref={tree4Ref} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      <mesh position={[-15, 2.5, -35]} castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>

      {/* ===== COLLECTIBLES ===== */}
      <Collectible
        position={[0, 1, -5] as [number, number, number]}
        type="coin"
        onCollect={() => {
          addCollectible()
        }}
      />

      <Collectible
        position={[5, 1, -15] as [number, number, number]}
        type="star"
        onCollect={() => {
          addCollectible()
        }}
      />

      <Collectible
        position={[-5, 1, -20] as [number, number, number]}
        type="gem"
        onCollect={() => {
          addCollectible()
        }}
      />

      <Collectible
        position={[10, 1, -10] as [number, number, number]}
        type="coin"
        onCollect={() => {
          addCollectible()
        }}
      />

      <Collectible
        position={[-10, 1, -30] as [number, number, number]}
        type="star"
        onCollect={() => {
          addCollectible()
        }}
      />
    </>
  )
}

export default World