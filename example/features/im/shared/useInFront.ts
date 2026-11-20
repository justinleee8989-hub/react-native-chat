import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

/**
 * Whether the caller's page is the one in front: false while another page is opened over it (that
 * page shows its own toasts), true again once it comes back.
 */
export function useInFront () {
  const [front, setFront] = useState(true)
  useFocusEffect(useCallback(() => {
    setFront(true)
    return () => setFront(false)
  }, []))
  return front
}
