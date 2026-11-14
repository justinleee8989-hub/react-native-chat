export interface DraftStorage {
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
  const queues = new Map<string, Promise<unknown>>()
  const revisions = new Map<string, number>()
  // A delivered draft must not reappear when persistent cleanup is unavailable.
  const clearedText = new Set<string>()
  const clearedMentions = new Set<string>()

  function key (account: string, conversationID: string) {
    return `${account}\u0000${conversationID}`
  }

  function enqueue (account: string, version: number, conversationID: string, action: () => Promise<unknown>) {
    const queueKey = key(account, conversationID)
    const previous = queues.get(queueKey) || Promise.resolve()
    const next = previous.catch(() => undefined).then(() => {
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
    return enqueue(account, version, conversationID, () => storage.write(account, conversationID, text))
  }

  return {
    setUser (nextUserID: string) {
      if (nextUserID === userID)
        return
      userID = nextUserID
      generation += 1
    },
    save (conversationID: string, text: string) {
      const revisionKey = key(userID, conversationID)
      if (text)
        clearedText.delete(revisionKey)
      revisions.set(revisionKey, (revisions.get(revisionKey) || 0) + 1)
      return saveFor(userID, generation, conversationID, text)
    },
    flushOnExit (expectedUserID: string, conversationID: string, text: string, sending: boolean) {
      if (sending || expectedUserID !== userID)
        return Promise.resolve()
      return this.save(conversationID, text)
    },
    saveMentions (conversationID: string, memberIDs: string[]) {
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
      if (!userID)
        return ''
      const account = userID
      const version = generation
      const pending = queues.get(key(account, conversationID))
      if (pending)
        await pending.catch(() => undefined)
      if (account !== userID || version !== generation)
        return ''
      return clearedText.has(key(account, conversationID)) ? '' : storage.read(account, conversationID)
    },
    async restoreMentions (conversationID: string) {
      if (!userID || !storage.readMentions)
        return []
      const account = userID
      const version = generation
      const pending = queues.get(key(account, conversationID))
      if (pending)
        await pending.catch(() => undefined)
      if (account !== userID || version !== generation)
        return []
      return clearedMentions.has(key(account, conversationID)) ? [] : storage.readMentions(account, conversationID)
    },
    async send<T> (conversationID: string, sendMessage: () => Promise<T>, onCleanupError: (error: unknown) => void = () => {}) {
      const account = userID
      const version = generation
      const revisionKey = key(account, conversationID)
      const revision = revisions.get(revisionKey) || 0
      const result = await sendMessage()
      if (account === userID && version === generation && revision === (revisions.get(revisionKey) || 0)) {
        revisions.set(revisionKey, revision + 1)
        clearedText.add(revisionKey)
        clearedMentions.add(revisionKey)
        await enqueue(account, version, conversationID, async () => {
          await storage.write(account, conversationID, '')
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
