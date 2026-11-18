import { useCallback } from 'react'
import type { IMessage, ReplyMessage } from '@kesha-antonov/react-native-chat'
import { reportError, sendMedia, sendPreparedChecked, sendQuote, sendTextChecked } from '../../application/store'
import type { useComposerEnhancements } from '../ComposerEnhancements'

/** Sends what the composer produced: a voice note, a quoted reply, or text with its @mentions. */
export function useChatSend ({ id, composer, accessNotice, accessError, setReply }: {
  id: string
  composer: ReturnType<typeof useComposerEnhancements>
  accessNotice: string
  accessError: string
  setReply: (reply: ReplyMessage | null) => void
}) {
  return useCallback(
    (messages: IMessage[]) => {
      if (accessNotice || accessError) {
        reportError(accessError || accessNotice)
        return
      }
      messages.forEach(message => {
        if (message.audio)
          void sendMedia(
            id,
            {
              type: 'audio',
              uri: message.audio,
              duration: message.duration,
            },
            message.replyMessage ? String(message.replyMessage._id) : undefined
          ).catch(reportError)
        else if (message.replyMessage)
          void composer
            .sendWithDraft(() => sendQuote(id, message.text, String(message.replyMessage!._id)))
            .catch(error => {
              setReply(message.replyMessage || null)
              reportError(error)
            })
        else
          void composer
            .sendWithDraft(async () => {
              const selected = composer.selectedMentions.filter(member =>
                message.text.includes(`@${member.nickname}`)
              )
              if (selected.length) {
                const created = await composer.buildAtMessage(message.text, selected)
                await sendPreparedChecked(id, created)
              } else {
                await sendTextChecked(id, message.text)
              }
            })
            .catch(reportError)
      })
    },
    [id, composer, accessNotice, accessError, setReply]
  )
}
