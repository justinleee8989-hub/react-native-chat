import { useCallback, useEffect, useRef } from 'react'
import { createAudioPlayer } from 'expo-audio'

export function useRingtone (ringing: boolean) {
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null)
  useEffect(() => {
    // Expo's web player uses Audio; construct only after hydration, never during SSR.
    if (!ringing)
      return
    const audio = createAudioPlayer(require('./ringtone.wav'))
    player.current = audio
    audio.loop = true
    audio.play()
    return () => {
      player.current = null
      audio.pause()
      audio.remove()
    }
  }, [ringing])
  return useCallback(() => player.current?.play(), [])
}
