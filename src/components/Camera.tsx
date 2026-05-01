import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useGameStore } from '../store/useGameStore'

/**
 * Camera Component
 * Third-person follow camera with collision detection to prevent clipping
 */
const Camera = () => {
  const { camera } = useThree()
  const vehiclePosition = useGameStore((state) => state.vehiclePosition)

  const cameraOffsetDistance = 10
  const cameraHeight = 5

  useFrame(() => {
    // Desired camera position
    const offset = new Vector3(0, cameraHeight, cameraOffsetDistance)
    const targetPosition = vehiclePosition.clone().add(offset)

    // Smooth follow with lerp
    camera.position.lerp(targetPosition, 0.08)

    // Look at the vehicle with slight upward offset
    const lookTarget = vehiclePosition.clone().add(new Vector3(0, 1, 0))
    camera.lookAt(lookTarget)

    // Simple collision detection: Check if camera is below terrain
    if (camera.position.y < 1) {
      camera.position.y = 1
    }

    // Prevent extreme angles
    const direction = camera.position.clone().sub(vehiclePosition)
    if (direction.length() > cameraOffsetDistance * 1.5) {
      direction.normalize().multiplyScalar(cameraOffsetDistance * 1.5)
      camera.position.copy(vehiclePosition.clone().add(direction))
    }
  })

  return null
}

export default Camera