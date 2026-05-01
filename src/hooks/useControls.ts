import { useKeyboardControls as useKeyboardControlsDrei } from '@react-three/drei'

/**
 * useControls Hook
 * Provides vehicle keyboard input by subscribing to KeyboardControls state
 */
export const useControls = () => {
  // Use selectors to subscribe to individual control states
  const forward = useKeyboardControlsDrei((state) => state.forward)
  const backward = useKeyboardControlsDrei((state) => state.backward)
  const left = useKeyboardControlsDrei((state) => state.left)
  const right = useKeyboardControlsDrei((state) => state.right)

  return {
    forward,
    backward,
    left,
    right,
  }
}