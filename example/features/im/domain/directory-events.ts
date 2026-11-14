export const contactDirectoryEvents = [
  'onSyncServerFinish',
  'onFriendAdded',
  'onFriendDeleted',
  'onFriendInfoChanged',
  'onFriendApplicationAdded',
  'onFriendApplicationAccepted',
  'onFriendApplicationRejected',
  'onFriendApplicationDeleted',
]
export const groupDirectoryEvents = [
  'onSyncServerFinish',
  'onGroupInfoChanged',
  'onGroupMemberAdded',
  'onGroupMemberDeleted',
  'onGroupMemberInfoChanged',
  'onJoinedGroupAdded',
  'onJoinedGroupDeleted',
  'onGroupDismissed',
]
export function subscribeDirectoryEvents (
  on: (event: string, callback: (data: unknown) => void) => () => void,
  events: string[],
  invalidate: () => void,
  groupID?: string
) {
  let active = true
  const cleanups = events.map(event =>
    on(event, data => {
      if (!active)
        return
      const changedGroup = (data as { groupID?: string } | undefined)?.groupID
      if (groupID && changedGroup && groupID !== changedGroup)
        return
      invalidate()
    })
  )
  return () => {
    active = false
    cleanups.forEach(cleanup => cleanup())
  }
}
