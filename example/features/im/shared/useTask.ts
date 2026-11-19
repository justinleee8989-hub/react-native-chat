import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { errorMessage } from './error-message'

export function useTask () {
  const [busy, setBusy] = useState(false)
  const tr = useT()
  // The failure itself, put into words on each render, so it follows a change of language.
  const [failure, setFailure] = useState<unknown>()
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
    setFailure(undefined)
    try {
      await work(() => alive.current)
      if (alive.current)
        setHasSucceeded(true)
    } catch (reason) {
      if (alive.current)
        setFailure(reason ?? new Error())
    }
    running.current = false
    if (alive.current)
      setBusy(false)
  }, [])
  return { busy, error: errorMessage(failure, tr), run, hasSucceeded }
}
