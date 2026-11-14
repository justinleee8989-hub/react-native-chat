import { draftStorage } from '../storage/draft-storage'

let scope = ''
export function getDraftStorageScope () {
  return scope
}
export function setDraftStorageScope (server: string) {
  scope = server
}
function draftKey (userID: string, conversationID: string) {
  return `im-composer:v2:${encodeURIComponent(scope)}:${encodeURIComponent(userID)}:${encodeURIComponent(conversationID)}`
}
interface DraftRecord { text?: string, mentions?: string[] }
async function readRecord (key: string): Promise<DraftRecord> {
  const value = await draftStorage.getItem(key)
  if (!value)
    return {}
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('本地草稿无法读取，请重试')
  return parsed as DraftRecord
}
export async function readLocalDraft (userID: string, conversationID: string) {
  return (await readRecord(draftKey(userID, conversationID))).text
}
const writes = new Map<string, Promise<unknown>>()
function writeRecord (key: string, update: (previous: DraftRecord) => DraftRecord) {
  const pending = (writes.get(key) || Promise.resolve()).catch(() => undefined).then(async () => {
    const previous = await readRecord(key)
    await draftStorage.setItem(key, JSON.stringify(update(previous)))
  })
  writes.set(key, pending)
  void pending.finally(() => {
    if (writes.get(key) === pending)
      writes.delete(key)
  }).catch(() => undefined)
  return pending
}
export async function writeLocalDraft (userID: string, conversationID: string, text: string) {
  if (text.length > 100000)
    throw new Error('草稿过长，暂时无法保存，请缩短后重试')
  const key = draftKey(userID, conversationID)
  await writeRecord(key, previous => ({ ...previous, text }))
}
export async function readDraftMentions (userID: string, conversationID: string) {
  const record = await readRecord(draftKey(userID, conversationID))
  return Array.isArray(record.mentions) && record.mentions.every(id => typeof id === 'string') ? record.mentions : []
}
export async function writeDraftMentions (userID: string, conversationID: string, memberIDs: string[]) {
  const key = draftKey(userID, conversationID)
  await writeRecord(key, previous => ({ ...previous, mentions: [...new Set(memberIDs)] }))
}
export async function clearDeliveredDraft (userID: string, conversationID: string) {
  // Keep an explicit empty record so an SDK cleanup failure cannot resurrect delivered text.
  await writeRecord(draftKey(userID, conversationID), () => ({ text: '', mentions: [] }))
}
