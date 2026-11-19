import { useEffect, useState } from 'react'
import { profile } from '../application/profile'
import type { SelfProfile } from '../domain/profile'

/**
 * The signed-in user's own profile, loaded once when the caller mounts; undefined until it arrives
 * or if it cannot be loaded (callers fall back to the user ID).
 */
export function useSelfProfile () {
  const [self, setSelf] = useState<SelfProfile>()
  useEffect(() => {
    let alive = true
    void profile.self().then(result => {
      if (alive)
        setSelf(result)
    }, () => {})
    return () => {
      alive = false
    }
  }, [])
  return self
}
