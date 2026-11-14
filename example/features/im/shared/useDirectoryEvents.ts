import { useEffect, useRef, useState } from 'react'
import { subscribeDirectory } from '../application/directory'

/** Mutations may resolve before the SDK cache changes. Keep events received during a mutation pending. */
export function useDirectoryEvents (
  events: string[],
  refresh: () => Promise<void>,
  busy: boolean,
  groupID?: string
) {
  const [revision, setRevision] = useState(0)
  const dirty = useRef(false)
  useEffect(
    () =>
      subscribeDirectory(
        events,
        () => {
          dirty.current = true
          setRevision(value => value + 1)
        },
        groupID
      ),
    [events, groupID]
  )
  useEffect(() => {
    if (busy || !dirty.current)
      return
    dirty.current = false
    void refresh()
  }, [revision, busy, refresh])
}
