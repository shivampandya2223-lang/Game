import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { useGameStore } from '../store/useGameStore'

/**
 * useAudio Hook
 * Manages game audio including engine sounds, collisions, and background music
 * Uses Howler.js for cross-browser audio support
 */
export const useAudio = () => {
  const soundsRef = useRef<Record<string, Howl>>({})
  const isMuted = useGameStore((state) => state.isMuted)

  useEffect(() => {
    // Initialize audio files (placeholder URLs - replace with actual audio)
    // In production, host audio files on CDN or bundle them
    soundsRef.current = {
      engine: new Howl({
        src: ['data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='],
        loop: true,
        volume: 0.5,
        autoplay: false,
      }),
      collision: new Howl({
        src: ['data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='],
        volume: 0.7,
        autoplay: false,
      }),
      collectible: new Howl({
        src: ['data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='],
        volume: 0.8,
        autoplay: false,
      }),
      music: new Howl({
        src: ['data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='],
        loop: true,
        volume: 0.3,
        autoplay: false,
      }),
    }

    // Start background music
    if (!isMuted) {
      soundsRef.current.music?.play()
    }

    return () => {
      // Cleanup
      Object.values(soundsRef.current).forEach((sound) => {
        sound?.stop()
      })
    }
  }, [])

  const playSound = (soundName: string) => {
    if (!isMuted && soundsRef.current[soundName]) {
      soundsRef.current[soundName].stop()
      soundsRef.current[soundName].play()
    }
  }

  const setEngineVolume = (speed: number) => {
    if (soundsRef.current.engine) {
      // Volume increases with speed
      const volume = Math.min(0.5 + speed * 0.02, 1)
      soundsRef.current.engine.volume(volume)

      // Pitch increases with speed
      const rate = Math.min(0.8 + speed * 0.01, 1.5)
      soundsRef.current.engine.rate(rate)

      // Auto-play engine sound when moving
      if (speed > 0.5 && !soundsRef.current.engine.playing()) {
        soundsRef.current.engine.play()
      } else if (speed < 0.1 && soundsRef.current.engine.playing()) {
        soundsRef.current.engine.stop()
      }
    }
  }

  return {
    playSound,
    setEngineVolume,
    sounds: soundsRef.current,
  }
}
