import { create } from 'zustand'
import { Vector3 } from 'three'

interface GameState {
  // Vehicle state
  speed: number
  vehiclePosition: Vector3
  setVehiclePosition: (pos: Vector3) => void
  setSpeed: (spd: number) => void

  // Game state
  collectibles: number
  addCollectible: () => void
  isMuted: boolean
  toggleMute: () => void
}

export const useGameStore = create<GameState>((set) => ({
  speed: 0,
  vehiclePosition: new Vector3(0, 2, 0),
  setVehiclePosition: (pos) => set({ vehiclePosition: pos }),
  setSpeed: (spd) => set({ speed: spd }),

  collectibles: 0,
  addCollectible: () => set((state) => ({ collectibles: state.collectibles + 1 })),
  isMuted: false,
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
}))