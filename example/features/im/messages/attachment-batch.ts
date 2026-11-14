import type { IMMessage, MediaInput } from '../domain/types'

export type AttachmentBatchItemStatus = 'queued' | 'preparing' | 'ready' | 'sending' | 'failed' | 'sent'
export type AttachmentBatchStatus = 'ready' | 'sending' | 'failed' | 'completed' | 'cancelled' | 'blocked'

export interface AttachmentBatchItem {
  kind: 'media' | 'caption'
  status: AttachmentBatchItemStatus
  media?: MediaInput
  text?: string
  recovered?: boolean
  prepared?: IMMessage
  error?: string
}

export interface AttachmentBatch {
  id: string
  conversationID: string
  epoch: number
  scope?: string
  reply?: IMMessage
  items: AttachmentBatchItem[]
  status: AttachmentBatchStatus
  cancelled: boolean
  error?: string
}

export interface AttachmentPersistence {
  releaseResources?: () => void
  resolve?: (media: MediaInput) => Promise<MediaInput>
  retain: (scope: string, id: string, media: MediaInput) => Promise<MediaInput>
  save: (scope: string, batch: AttachmentBatch) => Promise<void>
  load: (scope: string) => Promise<AttachmentBatch[]>
  remove: (scope: string, id: string) => Promise<void>
}

interface AttachmentBatchDependencies {
  persistence?: AttachmentPersistence
  getScope?: () => string

  reconcile?: (conversationID: string, message: IMMessage) => Promise<boolean>
  getEpoch: () => number
  createMedia: (media: MediaInput, reply?: IMMessage) => Promise<IMMessage>
  createText: (text: string, reply?: IMMessage) => Promise<IMMessage>
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

  function create (conversationID: string, media: MediaInput[], caption = '', reply?: IMMessage) {
    const items: AttachmentBatchItem[] = media.map(item => ({ kind: 'media', media: item, status: 'queued' }))
    if (caption.trim())
      items.push({ kind: 'caption', text: caption, status: 'queued' })
    const batch: AttachmentBatch = {
      id: `attachment-batch-${Date.now()}-${Math.random().toString(36).slice(2)}-${++nextID}`,
      conversationID,
      reply,
      scope: dependencies.getScope?.(),
      epoch: dependencies.getEpoch(),
      items,
      status: 'ready',
      cancelled: false,
    }
    batches.set(batch.id, batch)
    notify()
    return copyBatch(batch)
  }

  async function persist (batch: AttachmentBatch) {
    if (dependencies.persistence && batch.scope)
      await dependencies.persistence.save(batch.scope, copyBatch(batch))
  }

  async function enqueue (conversationID: string, media: MediaInput[], caption = '', reply?: IMMessage) {
    if (!dependencies.persistence)
      return create(conversationID, media, caption, reply)
    const scope = dependencies.getScope?.()
    const epoch = dependencies.getEpoch()
    if (!scope)
      throw new Error('请先登录')
    for (const [id, batch] of batches)
      if (batch.status === 'completed' || batch.status === 'cancelled')
        batches.delete(id)
    if (batches.size >= 50 || media.length > 20)
      throw new Error('待发送附件过多，请完成或取消现有任务后重试')
    const id = `attachment-batch-${Date.now()}-${Math.random().toString(36).slice(2)}-${++nextID}`
    const batch: AttachmentBatch = { id, conversationID, scope, epoch, reply, items: [], status: 'ready', cancelled: false }
    try {
      for (let index = 0; index < media.length; index++)
        batch.items.push({ kind: 'media', status: 'queued', media: await dependencies.persistence.retain(scope, `${id}/${index}`, media[index]) })
      if (caption.trim())
        batch.items.push({ kind: 'caption', status: 'queued', text: caption })
      if (epoch !== dependencies.getEpoch() || scope !== dependencies.getScope?.())
        throw new Error('登录已改变，请重新选择附件')
      await persist(batch)
    } catch (error) {
      await dependencies.persistence.remove(scope, id).catch(() => undefined)
      throw error
    }
    if (epoch !== dependencies.getEpoch() || scope !== dependencies.getScope?.())
      throw new Error('登录已改变，附件已保存，请登录原账号后继续')
    batches.set(id, batch)
    notify()
    return copyBatch(batch)
  }

  async function restore () {
    const scope = dependencies.getScope?.()
    const epoch = dependencies.getEpoch()
    if (!scope || !dependencies.persistence)
      return
    const saved = await dependencies.persistence.load(scope)
    if (epoch !== dependencies.getEpoch() || scope !== dependencies.getScope?.())
      return
    for (const batch of saved) {
      if (batch.scope !== scope || batches.has(batch.id) || batch.cancelled || batch.status === 'completed')
        continue
      batch.items.forEach(item => {
        item.recovered = !!item.media && !!item.prepared
      })
      batch.epoch = epoch
      batch.status = 'failed'
      batch.error = '附件任务已恢复，请确认后继续发送'
      batches.set(batch.id, batch)
    }
    notify()
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

  async function cancel (id: string) {
    const batch = batches.get(id)
    if (!batch || batch.status === 'completed')
      return get(id)
    batch.cancelled = true
    batch.status = 'cancelled'
    batch.error = undefined
    await persist(batch)
    await dependencies.persistence?.remove(batch.scope!, batch.id)
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
      if (item.prepared && dependencies.reconcile && (item.recovered || item.status === 'sending' || item.status === 'failed')) {
        const delivered = await dependencies.reconcile(batch.conversationID, item.prepared)
        if (batch.cancelled || batch.epoch !== dependencies.getEpoch())
          throw new Error('登录已改变或附件批次已取消')
        if (delivered) {
          item.status = 'sent'
          item.error = undefined
          await persist(batch)
          releasePayload(item)
          notify()
          continue
        }
      }
      if (!item.prepared || item.recovered) {
        item.status = 'preparing'
        notify()
        try {
          const previousID = item.prepared?.clientMsgID
          const media = item.media && dependencies.persistence?.resolve ? await dependencies.persistence.resolve(item.media) : item.media
          item.prepared = item.kind === 'media'
            ? await dependencies.createMedia(media!, batch.reply)
            : await dependencies.createText(item.text!, batch.reply)
          if (previousID)
            item.prepared.clientMsgID = previousID
          item.recovered = false
          item.error = undefined
          if (!dependencies.persistence) {
            item.media = undefined
            item.text = undefined
          }
          item.status = 'ready'
          await persist(batch)
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
      await persist(batch)
      if (batch.cancelled || batch.epoch !== dependencies.getEpoch())
        throw new Error('登录已改变或附件批次已取消')
      notify()
      try {
        await dependencies.send(batch.conversationID, item.prepared)
        item.status = 'sent'
        item.error = undefined
        await persist(batch)
        releasePayload(item)
        notify()
      } catch (error) {
        if (batch.cancelled) {
          batch.status = 'cancelled'
          batch.items.forEach(releasePayload)
          notify()
          throw new Error('附件批次已取消')
        }
        if (item.status !== 'sent')
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
    await persist(batch)
    await dependencies.persistence?.remove(batch.scope!, batch.id)
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
    const result = process(batch).catch(async error => {
      if (!batch.cancelled && batch.status !== 'blocked') {
        batch.status = 'failed'
        batch.error = errorText(error)
        notify()
      }
      throw error
    }).finally(() => {
      if (running.get(id) === result)
        running.delete(id)
    })
    running.set(id, result)
    return result
  }

  function reset () {
    batches.clear()
    dependencies.persistence?.releaseResources?.()
    notify()
  }

  return { create, enqueue, restore, get, list, subscribe, getSnapshot, run, cancel, reset }
}
