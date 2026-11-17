import React from 'react'
import { JoinCall } from '../calls/CallControls'
import { CallMessage } from '../calls/CallMessage'
import { parseCallInvitation } from '../calls/invitation'
import { messageCallSignal } from '../calls/message-projection'
import type { IMMessage } from '../domain/types'
import { RichMessage } from './RichMessages'

export function MessageCustomContent ({ message, self, onCall, onError }: {
  message?: IMMessage
  self: string
  onCall: () => void
  onError: (error: unknown) => void
}) {
  const text = message?.textElem?.content || ''
  // Ordinary rows must not subscribe to call state or create unused rich-message gestures.
  return <>
    {messageCallSignal(message) && <CallMessage message={message} self={self} onCall={onCall} />}
    {parseCallInvitation(text) && <JoinCall text={text} own={message?.sendID === self} />}
    {(message?.contentType === 108 || message?.contentType === 109) && <RichMessage message={message} own={message?.sendID === self} onError={onError} />}
  </>
}
