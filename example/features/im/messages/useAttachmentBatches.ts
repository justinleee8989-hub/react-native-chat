import { useSyncExternalStore } from 'react'
import { getAttachmentBatchesSnapshot, subscribeAttachmentBatches } from '../application/store'

export function useAttachmentBatches () {
  return useSyncExternalStore(subscribeAttachmentBatches, getAttachmentBatchesSnapshot, getAttachmentBatchesSnapshot)
}
