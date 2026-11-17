import { useEffect, useState } from 'react'
import { contactDirectoryEvents, directory, subscribeDirectory } from '../application/directory'
import { groupApplicationEvents, groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import { directorySummary } from '../contacts/contact-summary'

const events = [...new Set([...contactDirectoryEvents, ...groupApplicationEvents])]

/** Count the full incoming inbox; an SDK event invalidates any older in-flight count. */
export function usePendingRequests (enabled = true) {
  const { session } = useOpenIM()
  const userID = session?.userID
  const token = session?.imToken
  const [result, setResult] = useState({ userID, token, count: 0 })
  useEffect(() => {
    if (!enabled || !userID || !token)
      return
    let alive = true
    let revision = 0
    const refresh = () => {
      const version = ++revision
      const current = () => alive && version === revision
      void Promise.all([
        directorySummary(offset => directory.requests(true, offset), current, item => item.handleResult === 0),
        directorySummary(offset => groupManagement.requests(true, offset), current, item => item.handleResult === 0),
      ]).then(counts => {
        if (current())
          setResult({ userID, token, count: counts[0] + counts[1] })
      }).catch(() => {})
    }
    const unsubscribe = subscribeDirectory(events, refresh)
    refresh()
    return () => {
      alive = false
      unsubscribe()
    }
  }, [enabled, userID, token])
  return enabled && userID === result.userID && token === result.token ? result.count : 0
}
