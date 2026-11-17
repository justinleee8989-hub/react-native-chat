import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './error-message'

export function useTask () {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasSucceeded, setHasSucceeded] = useState(false)
  const alive = useRef(false)
  const running = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const run = useCallback(async (work: (current: () => boolean) => Promise<void>) => {
    if (running.current)
      return
    running.current = true
    setBusy(true)
    setError('')
    try {
      await work(() => alive.current)
      if (alive.current)
        setHasSucceeded(true)
    } catch (reason) {
      if (alive.current)
        setError(errorMessage(reason))

    }
    running.current = false
    if (alive.current)
      setBusy(false)
  }, [])
  return { busy, error, run, hasSucceeded }
}
