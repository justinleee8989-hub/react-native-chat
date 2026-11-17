export interface DraftStorage {
  getScope?: () => string
  clearDelivered?: (userID: string, conversationID: string) => Promise<unknown>
  read: (userID: string, conversationID: string) => Promise<string>
  write: (userID: string, conversationID: string, text: string) => Promise<unknown>
  readMentions?: (userID: string, conversationID: string) => Promise<string[]>
  writeMentions?: (userID: string, conversationID: string, memberIDs: string[]) => Promise<unknown>
}

export interface InputStatus {
  conversationID: string
  userID: string
  platformIDs: number[]
}

/** Accept native objects, WASM `{ data }` events, and JSON payloads without trusting them. */
export function parseInputStatus (value: unknown): InputStatus | null {
  let payload = value
  if (typeof payload === 'string')
    try {
      payload = JSON.parse(payload)
    } catch {
      return null
    }

  if (payload && typeof payload === 'object' && 'data' in payload)
    payload = (payload as { data: unknown }).data
  if (!payload || typeof payload !== 'object')
    return null
  const status = payload as Partial<InputStatus>
  if (typeof status.conversationID !== 'string' || typeof status.userID !== 'string' || !Array.isArray(status.platformIDs) || !status.platformIDs.every(id => typeof id === 'number'))
    return null
  return { conversationID: status.conversationID, userID: status.userID, platformIDs: status.platformIDs }
}

/** Serializes draft changes per account and conversation, and ignores work from an old login. */
export function createComposerState (storage: DraftStorage) {
  let userID = ''
  let generation = 0
  let scope = storage.getScope?.() || ''
  function syncScope () {
    const next = storage.getScope?.() || ''
    if (scope !== next) {
      scope = next
      generation += 1
    }
  }
  const queues = new Map<string, Promise<unknown>>()
  const revisions = new Map<string, number>()
  const textVersions = new Map<string, number>()
  // A delivered draft must not reappear when persistent cleanup is unavailable.
  const clearedText = new Set<string>()
  const clearedMentions = new Set<string>()

  function key (account: string, conversationID: string) {
    return `${scope}\u0000${account}\u0000${conversationID}`
  }

  function enqueue (account: string, version: number, conversationID: string, action: () => Promise<unknown>) {
    const queueKey = key(account, conversationID)
    const previous = queues.get(queueKey) || Promise.resolve()
    const next = previous.catch(() => undefined).then(() => {
      syncScope()
      if (account !== userID || version !== generation)
        return
      return action()
    })
    queues.set(queueKey, next)
    return next
  }

  function saveFor (account: string, version: number, conversationID: string, text: string) {
    if (!account)
      return Promise.resolve()
    const draftKey = key(account, conversationID)
    const textVersion = (textVersions.get(draftKey) || 0) + 1
    textVersions.set(draftKey, textVersion)
    // Native SDK writes cross the bridge. Persist the newest pending value rather than
    // every intermediate keystroke, so successful-send cleanup cannot sit behind a backlog.
    return enqueue(account, version, conversationID, async () => {
      if (textVersions.get(draftKey) === textVersion)
        await storage.write(account, conversationID, text)
    })
  }

  return {
    setUser (nextUserID: string) {
      syncScope()
      if (nextUserID === userID)
        return
      userID = nextUserID
      generation += 1
    },
    save (conversationID: string, text: string) {
      syncScope()
      const revisionKey = key(userID, conversationID)
      if (text)
        clearedText.delete(revisionKey)
      revisions.set(revisionKey, (revisions.get(revisionKey) || 0) + 1)
      return saveFor(userID, generation, conversationID, text)
    },
    flushOnExit (expectedUserID: string, conversationID: string, text: string, sending: boolean, expectedScope = scope) {
      syncScope()
      if (sending || expectedUserID !== userID || expectedScope !== scope)
        return Promise.resolve()
      return this.save(conversationID, text)
    },
    saveMentions (conversationID: string, memberIDs: string[]) {
      syncScope()
      const account = userID
      const version = generation
      const revisionKey = key(account, conversationID)
      if (memberIDs.length)
        clearedMentions.delete(revisionKey)
      revisions.set(revisionKey, (revisions.get(revisionKey) || 0) + 1)
      if (!account || !storage.writeMentions)
        return Promise.resolve()
      const ids = [...new Set(memberIDs)]
      return enqueue(account, version, conversationID, () => storage.writeMentions!(account, conversationID, ids))
    },
    async restore (conversationID: string) {
      syncScope()
      if (!userID)
        return ''
      const account = userID
      const version = generation
      const pending = queues.get(key(account, conversationID))
      if (pending)
        await pending.catch(() => undefined)
      syncScope()
      if (account !== userID || version !== generation)
        return ''
      const value = clearedText.has(key(account, conversationID)) ? '' : await storage.read(account, conversationID)
      syncScope()
      return account === userID && version === generation ? value : ''
    },
    async restoreMentions (conversationID: string) {
      syncScope()
      if (!userID || !storage.readMentions)
        return []
      const account = userID
      const version = generation
      const pending = queues.get(key(account, conversationID))
      if (pending)
        await pending.catch(() => undefined)
      syncScope()
      if (account !== userID || version !== generation)
        return []
      const value = clearedMentions.has(key(account, conversationID)) ? [] : await storage.readMentions(account, conversationID)
      syncScope()
      return account === userID && version === generation ? value : []
    },
    async send<T> (conversationID: string, sendMessage: () => Promise<T>, onCleanupError: (error: unknown) => void = () => {}) {
      syncScope()
      const account = userID
      const version = generation
      const revisionKey = key(account, conversationID)
      const revision = revisions.get(revisionKey) || 0
      const result = await sendMessage()
      syncScope()
      if (account === userID && version === generation && revision === (revisions.get(revisionKey) || 0)) {
        revisions.set(revisionKey, revision + 1)
        textVersions.set(revisionKey, (textVersions.get(revisionKey) || 0) + 1)
        clearedText.add(revisionKey)
        clearedMentions.add(revisionKey)
        await enqueue(account, version, conversationID, async () => {
          await storage.clearDelivered?.(account, conversationID)
          syncScope()
          if (account !== userID || version !== generation)
            return
          await storage.write(account, conversationID, '')
          syncScope()
          if (account !== userID || version !== generation)
            return
          await storage.writeMentions?.(account, conversationID, [])
        }).catch(error => {
          if (account === userID && version === generation)
            onCleanupError(error)
        })
      }
      return result
    },
  }
}
