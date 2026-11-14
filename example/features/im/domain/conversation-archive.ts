const ARCHIVE_NAMESPACE = '$reactNativeChatArchive'
const LEGACY_EX_KEY = '$legacyConversationEx'

type ArchiveMetadata = { version: 1, archivedByUser: Record<string, boolean> }

function isRecord (value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseEx (ex?: string) {
  if (!ex)
    return {}
  try {
    const value: unknown = JSON.parse(ex)
    return isRecord(value) ? value : { [LEGACY_EX_KEY]: ex }
  } catch {
    return { [LEGACY_EX_KEY]: ex }
  }
}

export function isConversationArchived (ex: string | undefined, userID: string) {
  if (!userID)
    return false
  const value = parseEx(ex)
  const metadata = value[ARCHIVE_NAMESPACE]
  if (!isRecord(metadata) || metadata.version !== 1 || !isRecord(metadata.archivedByUser))
    return false
  return Object.hasOwn(metadata.archivedByUser, userID) && metadata.archivedByUser[userID] === true
}

export function updateConversationArchiveEx (ex: string | undefined, userID: string, archived: boolean) {
  if (!userID)
    throw new Error('缺少当前用户，无法更新归档状态')
  const value = parseEx(ex)
  const existing = value[ARCHIVE_NAMESPACE]
  if (existing !== undefined && (!isRecord(existing) || existing.version !== 1 || !isRecord(existing.archivedByUser)))
    throw new Error('会话 ex 已包含未知的归档数据，拒绝覆盖')
  const metadata = existing as ArchiveMetadata | undefined
  const archivedByUser = Object.assign(Object.create(null), metadata?.archivedByUser || {}) as Record<string, boolean>
  if (archived)
    archivedByUser[userID] = true
  else
    delete archivedByUser[userID]
  value[ARCHIVE_NAMESPACE] = { ...metadata, version: 1, archivedByUser }
  return JSON.stringify(value)
}
