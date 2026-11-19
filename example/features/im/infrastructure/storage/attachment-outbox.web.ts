import type { AttachmentBatch, AttachmentPersistence } from '../../messages/attachment-batch'
import { ProductError } from '../../shared/product-error.ts'

const databaseName = 'im-attachment-outbox-v1'
const assetPrefix = 'im-outbox:'
const urls = new Map<string, string>()
const MAX_BYTES = 100 * 1024 * 1024

async function database () {
  if (typeof indexedDB === 'undefined')
    throw new ProductError('outbox.noStorage')
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('batches')
      request.result.createObjectStore('assets')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new ProductError('outbox.busy'))
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
      tx.onabort = () => reject(tx.error || new ProductError('outbox.saveFailed'))
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
      throw new ProductError('outbox.unreadable')
    const blob = await response.blob()
    if (blob.size > MAX_BYTES)
      throw new ProductError('outbox.tooLarge')
    const key = batchKey(scope, id)
    await transaction('assets', 'readwrite', store => store.put(blob, key))
    return { ...media, uri: `${assetPrefix}${key}` }
  },
  async resolve (media) {
    if (!media.uri.startsWith(assetPrefix))
      throw new ProductError('outbox.badFormat')
    const key = media.uri.slice(assetPrefix.length)
    let uri = urls.get(key)
    if (!uri) {
      const blob = await transaction('assets', 'readonly', store => store.get(key)) as Blob | undefined
      if (!blob)
        throw new ProductError('outbox.removed')
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
