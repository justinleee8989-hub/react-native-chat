import type { IMMessage, MediaInput } from '../domain/types'

export type AttachmentBatchItemStatus = 'queued' | 'preparing' | 'ready' | 'sending' | 'failed' | 'sent'
export type AttachmentBatchStatus = 'ready' | 'sending' | 'failed' | 'completed' | 'cancelled' | 'blocked'

export interface AttachmentBatchItem {
  kind: 'media' | 'caption'
  status: AttachmentBatchItemStatus
  media?: MediaInput
  text?: string
  prepared?: IMMessage
  error?: string
}

export interface AttachmentBatch {
  id: string
  conversationID: string
  epoch: number
  items: AttachmentBatchItem[]
  status: AttachmentBatchStatus
  cancelled: boolean
  error?: string
}

interface AttachmentBatchDependencies {
  getEpoch: () => number
  createMedia: (media: MediaInput) => Promise<IMMessage>
  createText: (text: string) => Promise<IMMessage>
  send: (conversationID: string, message: IMMessage) => Promise<void>
}

function errorText (error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function copyBatch (batch: AttachmentBatch): AttachmentBatch {
  return { ...batch, items: batch.items.map(item => ({ ...item })) }
}

function releasePayload (item: AttachmentBatchItem) {
  item.media = undefined
  item.prepared = undefined
  item.text = undefined
}

export function createAttachmentBatchManager (dependencies: AttachmentBatchDependencies) {
  const batches = new Map<string, AttachmentBatch>()
  const running = new Map<string, Promise<void>>()
  const listeners = new Set<() => void>()
  let snapshot: AttachmentBatch[] = []
  let snapshotEpoch = dependencies.getEpoch()
  let nextID = 0

  function notify () {
    snapshotEpoch = dependencies.getEpoch()
    snapshot = [...batches.values()].filter(batch => batch.epoch === snapshotEpoch).map(copyBatch)
    listeners.forEach(listener => listener())
  }

  function create (conversationID: string, media: MediaInput[], caption = '') {
    const items: AttachmentBatchItem[] = media.map(item => ({ kind: 'media', media: item, status: 'queued' }))
    if (caption.trim())
      items.push({ kind: 'caption', text: caption, status: 'queued' })
    const batch: AttachmentBatch = {
      id: `attachment-batch-${++nextID}`,
      conversationID,
      epoch: dependencies.getEpoch(),
      items,
      status: 'ready',
      cancelled: false,
    }
    batches.set(batch.id, batch)
    notify()
    return copyBatch(batch)
  }

  function get (id: string) {
    const batch = batches.get(id)
    return batch ? copyBatch(batch) : undefined
  }

  function list () {
    const epoch = dependencies.getEpoch()
    return [...batches.values()].filter(batch => batch.epoch === epoch).map(copyBatch)
  }

  function subscribe (listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot () {
    const epoch = dependencies.getEpoch()
    if (epoch !== snapshotEpoch) {
      snapshotEpoch = epoch
      snapshot = [...batches.values()].filter(batch => batch.epoch === epoch).map(copyBatch)
    }
    return snapshot
  }

  function cancel (id: string) {
    const batch = batches.get(id)
    if (!batch || batch.status === 'completed')
      return get(id)
    batch.cancelled = true
    batch.status = 'cancelled'
    batch.error = undefined
    batch.items.forEach(item => {
      if (item.status !== 'preparing' && item.status !== 'sending')
        releasePayload(item)
    })
    notify()
    return copyBatch(batch)
  }

  async function process (batch: AttachmentBatch) {
    if (batch.cancelled)
      throw new Error('附件批次已取消')
    if (batch.epoch !== dependencies.getEpoch()) {
      batch.status = 'blocked'
      batch.error = '登录已改变，请勿继续发送旧账号附件'
      batch.items.forEach(releasePayload)
      notify()
      throw new Error(batch.error)
    }
    batch.status = 'sending'
    batch.error = undefined
    notify()
    for (const item of batch.items) {
      if (item.status === 'sent')
        continue
      if (batch.cancelled)
        throw new Error('附件批次已取消')
      if (batch.epoch !== dependencies.getEpoch()) {
        batch.status = 'blocked'
        batch.error = '登录已改变，请勿继续发送旧账号附件'
        notify()
        throw new Error(batch.error)
      }
      if (!item.prepared) {
        item.status = 'preparing'
        notify()
        try {
          item.prepared = item.kind === 'media'
            ? await dependencies.createMedia(item.media!)
            : await dependencies.createText(item.text!)
          item.error = undefined
          item.media = undefined
          item.text = undefined
          item.status = 'ready'
          notify()
        } catch (error) {
          if (batch.cancelled) {
            batch.status = 'cancelled'
            batch.items.forEach(releasePayload)
            notify()
            throw new Error('附件批次已取消')
          }
          item.status = 'failed'
          item.error = errorText(error)
          batch.status = 'failed'
          batch.error = item.error
          notify()
          throw error
        }
      }
      if (batch.epoch !== dependencies.getEpoch()) {
        batch.status = 'blocked'
        batch.error = '登录已改变，请勿继续发送旧账号附件'
        batch.items.forEach(releasePayload)
        notify()
        throw new Error(batch.error)
      }
      if (batch.cancelled) {
        batch.status = 'cancelled'
        batch.items.forEach(releasePayload)
        notify()
        throw new Error('附件批次已取消')
      }
      item.status = 'sending'
      notify()
      try {
        await dependencies.send(batch.conversationID, item.prepared)
        item.status = 'sent'
        item.error = undefined
        releasePayload(item)
        notify()
      } catch (error) {
        if (batch.cancelled) {
          batch.status = 'cancelled'
          batch.items.forEach(releasePayload)
          notify()
          throw new Error('附件批次已取消')
        }
        item.status = 'failed'
        item.error = errorText(error)
        batch.status = 'failed'
        batch.error = item.error
        notify()
        throw error
      }
    }
    batch.status = batch.cancelled ? 'cancelled' : 'completed'
    if (batch.cancelled)
      batch.items.forEach(releasePayload)
    notify()
    if (batch.cancelled)
      throw new Error('附件批次已取消')
  }

  function run (id: string): Promise<void> {
    const current = running.get(id)
    if (current)
      return current
    const batch = batches.get(id)
    if (!batch)
      return Promise.reject(new Error('附件批次不存在'))
    const result = process(batch).finally(() => {
      if (running.get(id) === result)
        running.delete(id)
    })
    running.set(id, result)
    return result
  }

  function reset () {
    batches.clear()
    notify()
  }

  return { create, get, list, subscribe, getSnapshot, run, cancel, reset }
}
