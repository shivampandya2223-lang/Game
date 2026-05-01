import { usePlane } from '@react-three/cannon'

interface TriggerZoneProps {
  position: [number, number, number]
  scale: [number, number, number]
}

/**
 * TriggerZone Component
 * Invisible trigger areas that fire events when vehicle enters
 */
const TriggerZone = ({
  position,
  scale,
}: TriggerZoneProps) => {
  const [ref] = usePlane(() => ({
    position,
    args: scale,
    sensor: true,
    type: 'Static',
  }))

  // Trigger zone is prepared for future collision detection

  return (
    <>
      {/* Invisible trigger plane */}
      <mesh ref={ref} visible={false}>
        <planeGeometry args={scale} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Visual indicator (optional - remove in production) */}
      <mesh position={position} scale={scale}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0.1} color="cyan" />
      </mesh>
    </>
  )
}

export default TriggerZone
