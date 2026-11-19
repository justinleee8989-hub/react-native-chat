import React from 'react'
import type { AttachmentsProps, ReplyMessage } from '@kesha-antonov/react-native-chat'
import { reportError, sendAttachmentBatchChecked, sendCard, sendLocation } from '../../application/store'
import type { Session } from '../../domain/types'
import { ProductError } from '../../shared/product-error'
import { ProductComposerMenu } from '../ProductComposerMenu'

/**
 * The composer's attachment menu. Each send reads the reply being written when it starts and
 * clears it only if it is still that one, and an attachment picked before a re-login is refused.
 */
export function chatAttachments ({ id, group, activeReply, batchSession, session, setReply, onMention }: {
  id: string
  group: boolean
  activeReply: { current: ReplyMessage | null }
  batchSession: { current: Session | undefined }
  session?: Session
  setReply: (update: (current: ReplyMessage | null) => ReplyMessage | null) => void
  onMention: () => void
}): AttachmentsProps {
  const sent = (sendingReply: ReplyMessage | null) =>
    setReply(current => (current === sendingReply ? null : current))
  return {
    tabs: ['gallery', 'camera', 'file'],
    renderAttachmentMenu: props => (
      <ProductComposerMenu
        {...props}
        onMention={group ? onMention : undefined}
        onLocation={async location => {
          const sendingReply = activeReply.current
          await sendLocation(id, location, sendingReply ? String(sendingReply._id) : undefined)
          sent(sendingReply)
        }}
        onCard={async card => {
          const sendingReply = activeReply.current
          await sendCard(id, card, sendingReply ? String(sendingReply._id) : undefined)
          sent(sendingReply)
        }}
      />
    ),
    isGalleryGridEnabled: false,
    onPick: async (attachments, { caption }) => {
      try {
        const sendingReply = activeReply.current
        const sourceID = sendingReply ? String(sendingReply._id) : undefined
        if (batchSession.current !== session)
          throw new ProductError('attachments.signInChangedResend')
        await sendAttachmentBatchChecked(
          id,
          attachments
            .filter(attachment => attachment.type !== 'location')
            .map(attachment => ({
              ...attachment,
              name: attachment.type === 'file' ? attachment.name : attachment.fileName,
            })),
          caption,
          sourceID
        )
        sent(sendingReply)
      } catch (error) {
        reportError(error)
      }
      return null
    },
  }
}
