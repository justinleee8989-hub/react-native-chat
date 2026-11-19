import type { Conversation, ServerConfig } from '../../domain/types'
import { ProductError } from '../../shared/product-error.ts'

interface SnapshotStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<unknown>
  removeItem: (key: string) => Promise<unknown>
}
export interface HomeSnapshot { userID: string, version: 1, savedAt: number, conversations: Conversation[] }
const MAX_HOME_CONVERSATIONS = 200
const MAX_HOME_CHARACTERS = 2_000_000
const keyFor = (userID: string, config: ServerConfig) =>
  `openim-home-v1:${JSON.stringify([userID, config.api, config.ws, config.chat])}`

/** Display-only cache. Credentials and message history never enter this storage. */
export function createHomeSnapshots (storage: SnapshotStorage) {
  let writes = Promise.resolve()
  const enqueue = (work: () => Promise<unknown>, required = false) => {
    const result = writes.then(work).then(() => {})
    // Keep the queue usable after an error, but required mutations must observe failure.
    writes = result.catch(() => {})
    return required ? result : writes
  }
  return {
    async load (userID: string, config: ServerConfig): Promise<HomeSnapshot | undefined> {
      try {
        const raw = await storage.getItem(keyFor(userID, config))
        if (!raw || raw.length > MAX_HOME_CHARACTERS)
          return
        const value = JSON.parse(raw) as HomeSnapshot
        if (value.userID !== userID || value.version !== 1 || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 7 * 86400_000 || !Array.isArray(value.conversations) || value.conversations.length > MAX_HOME_CONVERSATIONS)
          return
        if (!value.conversations.every(item => item && typeof item.conversationID === 'string' && typeof item.showName === 'string' && Number.isFinite(item.unreadCount) && Number.isFinite(item.conversationType)))
          return
        return value
      } catch {
        // A missing/corrupt cache must never stop login or SDK recovery.
        return
      }
    },
    save (userID: string, config: ServerConfig, conversations: Conversation[], options?: { required?: boolean }) {
      const snapshot: HomeSnapshot = {
        userID,
        version: 1,
        savedAt: Date.now(),
        conversations: conversations.slice(0, MAX_HOME_CONVERSATIONS).map(item => ({
          conversationID: item.conversationID,
          conversationType: item.conversationType,
          userID: item.userID,
          groupID: item.groupID,
          showName: item.showName.slice(0, 256),
          faceURL: item.faceURL,
          unreadCount: item.unreadCount,
          isPinned: item.isPinned,
          recvMsgOpt: item.recvMsgOpt,
          ex: (item.ex?.length || 0) <= 4096 ? item.ex : undefined,
          // Bound the preview as well as the number of rows; attachment bodies can be large.
          latestMsg: (item.latestMsg?.length || 0) <= 4096 ? item.latestMsg : undefined,
        })),
      }
      const value = JSON.stringify(snapshot)
      return enqueue(async () => {
        const key = keyFor(userID, config)
        try {
          if (value.length > MAX_HOME_CHARACTERS) {
            if (options?.required)
              await storage.removeItem(key)
            return
          }
          await storage.setItem(key, value)
        } catch (error) {
          if (!options?.required)
            throw error
          // After delete/clear, no snapshot is safer than a stale one. Removing also
          // frees quota if overwriting failed because storage is full.
          try {
            await storage.removeItem(key)
          } catch {
            throw new ProductError('snapshot.clearFailed')
          }
        }
      }, options?.required)
    },
    remove (userID: string, config: ServerConfig) {
      return enqueue(() => storage.removeItem(keyFor(userID, config)))
    },
  }
}
