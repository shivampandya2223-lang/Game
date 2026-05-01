import { useBox } from '@react-three/cannon'
import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3, Group } from 'three'
import { useControls } from '../hooks/useControls'
import { useGameStore } from '../store/useGameStore'

/**
 * Vehicle Component
 * Realistic car physics with acceleration, braking, steering, and suspension feel
 */
const Vehicle = () => {
  const groupRef = useRef<Group>(null)
  const [ref, api] = useBox(() => ({
    mass: 1.5,
    shape: 'box',
    position: [0, 2, 0],
    linearDamping: 0.5,
    angularDamping: 0.8,
    args: [2, 1, 4],
  }))

  const controls = useControls()
  const setVehiclePosition = useGameStore((state) => state.setVehiclePosition)
  const setSpeed = useGameStore((state) => state.setSpeed)

  // Vehicle state
  const velocityRef = useRef<[number, number, number]>([0, 0, 0])
  const wheelRotationRef = useRef(0)
  const currentSpeedRef = useRef(0)

  // Physics parameters
  const MAX_SPEED = 30
  const ACCELERATION = 100
  const DECELERATION = 50
  const TURN_SPEED = 3.5
  const DRAG_COEFFICIENT = 0.02

  useEffect(() => {
    // Subscribe to position changes
    const unsubscribePos = api.position.subscribe((pos) => {
      setVehiclePosition(new Vector3(pos[0], pos[1], pos[2]))
    })

    // Subscribe to velocity changes
    const unsubscribeVel = api.velocity.subscribe((vel) => {
      velocityRef.current = vel
      const speed = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2)
      currentSpeedRef.current = speed
      setSpeed(speed)
    })

    return () => {
      unsubscribePos()
      unsubscribeVel()
    }
  }, [api, setVehiclePosition, setSpeed])

  useFrame((_, delta) => {
    if (!ref.current || !groupRef.current) return

    // Get current velocity and rotation
    const vel = velocityRef.current
    const currentSpeed = currentSpeedRef.current
    const rotation = ref.current.rotation.y

    // Calculate forward direction based on vehicle rotation
    const forward = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), rotation)

    let accelerationForce = new Vector3(0, 0, 0)
    let steeringTorque = 0
    let brakingForce = 0

    // Forward/Backward acceleration
    if (controls.forward && currentSpeed < MAX_SPEED) {
      accelerationForce.add(forward.clone().multiplyScalar(ACCELERATION))
    } else if (controls.backward && currentSpeed > -MAX_SPEED * 0.5) {
      accelerationForce.add(forward.clone().multiplyScalar(-ACCELERATION * 0.5))
    } else {
      // Natural deceleration (friction)
      brakingForce = DECELERATION
    }

    // Steering
    if (controls.left) {
      steeringTorque = TURN_SPEED
    }
    if (controls.right) {
      steeringTorque = -TURN_SPEED
    }

    // Apply drag force (air resistance)
    const dragForce = new Vector3(vel[0], 0, vel[2])
      .normalize()
      .multiplyScalar(-DRAG_COEFFICIENT * currentSpeed)

    // Apply forces
    api.applyForce(
      [accelerationForce.x + dragForce.x, accelerationForce.y, accelerationForce.z + dragForce.z],
      [0, 0, 0]
    )

    // Apply steering torque
    api.applyTorque([0, steeringTorque, 0])

    // Brake if no input
    if (brakingForce > 0 && !controls.forward && !controls.backward) {
      api.applyForce(
        [-vel[0] * brakingForce * 0.5, 0, -vel[2] * brakingForce * 0.5],
        [0, 0, 0]
      )
    }

    // Update wheel rotation for visual feedback
    const wheelDelta = currentSpeed * delta
    wheelRotationRef.current += wheelDelta / 0.5 // 0.5 is wheel radius

    // Update visual rotation
    if (groupRef.current) {
      groupRef.current.rotation.copy(ref.current.rotation)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main car body */}
      <mesh ref={ref} castShadow>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial color="#c41e3a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Car roof */}
      <mesh position={[0, 0.8, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.6, 1.8]} />
        <meshStandardMaterial color="#e63946" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Windows */}
      <mesh position={[0, 0.55, -0.5]} castShadow>
        <boxGeometry args={[1.4, 0.4, 0.8]} />
        <meshStandardMaterial color="#87ceeb" transparent opacity={0.6} />
      </mesh>

      {/* Wheels - Front Left */}
      {/* Wheels - Front Left */}
      <mesh position={[-1, 0.5, 0.8]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Wheels - Front Right */}
      <mesh position={[1, 0.5, 0.8]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Wheels - Back Left */}
      <mesh position={[-1, 0.5, -1.2]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Wheels - Back Right */}
      <mesh position={[1, 0.5, -1.2]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

export default Vehicle