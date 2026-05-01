import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import './MiniMap.css'

/**
 * MiniMap Component
 * Shows a top-down view of the game world and vehicle position
 */
const MiniMap = () => {
  const vehiclePosition = useGameStore((state) => state.vehiclePosition)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // World boundaries
  const WORLD_SIZE = 100
  const MAP_SIZE = 200 // pixels

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

    // Draw grid
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    for (let i = 0; i <= WORLD_SIZE; i += 10) {
      const x = (i / WORLD_SIZE) * MAP_SIZE
      const y = (i / WORLD_SIZE) * MAP_SIZE
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, MAP_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(MAP_SIZE, y)
      ctx.stroke()
    }

    // Draw static objects (simplified)
    ctx.fillStyle = '#666'
    // Buildings
    ctx.fillRect((10 / WORLD_SIZE) * MAP_SIZE, (20 / WORLD_SIZE) * MAP_SIZE, 20, 20)
    ctx.fillRect((-10 / WORLD_SIZE) * MAP_SIZE + MAP_SIZE, (25 / WORLD_SIZE) * MAP_SIZE, 15, 15)

    // Draw vehicle
    const vehicleX = ((vehiclePosition.x + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE
    const vehicleY = ((vehiclePosition.z + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE

    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    ctx.arc(vehicleX, vehicleY, 5, 0, Math.PI * 2)
    ctx.fill()

    // Draw direction indicator
    ctx.strokeStyle = '#ff4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(vehicleX, vehicleY)
    ctx.lineTo(vehicleX + Math.sin(0) * 8, vehicleY - Math.cos(0) * 8)
    ctx.stroke()
  }, [vehiclePosition])

  return (
    <div className="minimap">
      <h3>Map</h3>
      <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} />
    </div>
  )
}

export default MiniMap
