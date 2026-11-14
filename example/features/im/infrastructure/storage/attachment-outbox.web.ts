import type { AttachmentBatch, AttachmentPersistence } from '../../messages/attachment-batch'

const databaseName = 'im-attachment-outbox-v1'
const assetPrefix = 'im-outbox:'
const urls = new Map<string, string>()
const MAX_BYTES = 100 * 1024 * 1024

async function database () {
  if (typeof indexedDB === 'undefined')
    throw new Error('浏览器无法保存附件，请启用本地存储后重试')
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('batches')
      request.result.createObjectStore('assets')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('附件存储被其他页面占用，请关闭旧页面后重试'))
  })
}

async function transaction<T> (storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const request = action(tx.objectStore(storeName))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error || request.error)
      tx.onabort = () => reject(tx.error || new Error('附件保存失败，请检查本地存储空间后重试'))
    })
  } finally {
    db.close()
  }
}
const batchKey = (scope: string, id: string) => `${encodeURIComponent(scope)}/${id}`

export const attachmentOutbox: AttachmentPersistence = {
  releaseResources () {
    urls.forEach(uri => URL.revokeObjectURL(uri))
    urls.clear()
  },
  async retain (scope, id, media) {
    const response = await fetch(media.uri)
    if (!response.ok)
      throw new Error('无法读取附件，请重新选择')
    const blob = await response.blob()
    if (blob.size > MAX_BYTES)
      throw new Error('单个附件不能超过 100 MB')
    const key = batchKey(scope, id)
    await transaction('assets', 'readwrite', store => store.put(blob, key))
    return { ...media, uri: `${assetPrefix}${key}` }
  },
  async resolve (media) {
    if (!media.uri.startsWith(assetPrefix))
      throw new Error('附件存储格式不正确，请重新选择')
    const key = media.uri.slice(assetPrefix.length)
    let uri = urls.get(key)
    if (!uri) {
      const blob = await transaction('assets', 'readonly', store => store.get(key)) as Blob | undefined
      if (!blob)
        throw new Error('附件已从本地存储移除，请取消任务并重新选择')
      uri = URL.createObjectURL(blob)
      urls.set(key, uri)
    }
    return { ...media, uri }
  },
  async save (scope, batch) {
    await transaction('batches', 'readwrite', store => store.put(batch, batchKey(scope, batch.id)))
  },
  async load (scope) {
    const range = IDBKeyRange.bound(`${encodeURIComponent(scope)}/`, `${encodeURIComponent(scope)}/\uffff`)
    return await transaction('batches', 'readonly', store => store.getAll(range)) as AttachmentBatch[]
  },
  async remove (scope, id) {
    const key = batchKey(scope, id)
    await transaction('batches', 'readwrite', store => store.delete(key))
    await transaction('assets', 'readwrite', store => store.delete(IDBKeyRange.bound(`${key}/`, `${key}/\uffff`)))
    for (const [asset, uri] of urls)
      if (asset.startsWith(`${key}/`)) {
        URL.revokeObjectURL(uri)
        urls.delete(asset)
      }
  },
}
