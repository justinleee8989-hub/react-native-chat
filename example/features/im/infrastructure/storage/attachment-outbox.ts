import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import type { AttachmentBatch, AttachmentPersistence } from '../../messages/attachment-batch'

const prefix = 'im-attachment-outbox:v1:'
const root = () => new Directory(Paths.document, 'im-attachment-outbox-v1')
const scopeKey = (scope: string) => encodeURIComponent(scope)
const directory = (scope: string, id: string) => new Directory(root(), scopeKey(scope), id)
const recordKey = (scope: string, id: string) => `${prefix}${scopeKey(scope)}:${id}`
const MAX_BYTES = 100 * 1024 * 1024

export const attachmentOutbox: AttachmentPersistence = {
  async retain (scope, assetID, media) {
    const [id, index] = assetID.split('/')
    const folder = directory(scope, id)
    folder.create({ intermediates: true, idempotent: true })
    const original = new File(media.uri)
    if (original.size > MAX_BYTES)
      throw new Error('单个附件不能超过 100 MB')
    const target = new File(folder, `${index}-${(media.name || original.name || media.type).replace(/[^a-zA-Z0-9._-]/g, '_')}`)
    original.copy(target)
    return { ...media, uri: target.uri }
  },
  async save (scope, batch) {
    await AsyncStorage.setItem(recordKey(scope, batch.id), JSON.stringify(batch))
  },
  async load (scope) {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`${prefix}${scopeKey(scope)}:`))
    const records = await Promise.all(keys.map(key => AsyncStorage.getItem(key)))
    return records.filter((value): value is string => value !== null).map(value => JSON.parse(value) as AttachmentBatch)
  },
  async remove (scope, id) {
    await AsyncStorage.removeItem(recordKey(scope, id))
    const folder = directory(scope, id)
    if (folder.exists)
      folder.delete()
  },
}
