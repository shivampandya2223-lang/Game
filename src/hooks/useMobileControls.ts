import { useState, useEffect, useRef } from 'react'

interface TouchControls {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

/**
 * useMobileControls Hook
 * Provides touch-based controls for mobile devices
 * Uses virtual joystick and buttons
 */
export const useMobileControls = () => {
  const [controls, setControls] = useState<TouchControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  const joystickRef = useRef<HTMLDivElement>(null)
  const isJoystickActiveRef = useRef(false)
  const joystickStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!joystickRef.current) return

      const touch = e.touches[0]
      const rect = joystickRef.current.getBoundingClientRect()

      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        isJoystickActiveRef.current = true
        joystickStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isJoystickActiveRef.current || !joystickRef.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - joystickStartRef.current.x
      const deltaY = touch.clientY - joystickStartRef.current.y

      const threshold = 30

      setControls({
        forward: deltaY < -threshold,
        backward: deltaY > threshold,
        left: deltaX < -threshold,
        right: deltaX > threshold,
      })
    }

    const handleTouchEnd = () => {
      isJoystickActiveRef.current = false
      setControls({
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
    }

    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return {
    controls,
    joystickRef,
  }
}
