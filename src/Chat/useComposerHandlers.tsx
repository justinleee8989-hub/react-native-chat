import React, { RefObject, useCallback, useEffect, useInsertionEffect, useMemo, useRef } from 'react'
import { TextInput } from 'react-native'
import { AnimatedList } from '../MessagesContainer'
import { IMessage, ReplyMessage } from '../Models'
import { Store } from '../store'
import { ComposerHost } from './ComposerHost'
import { ChatProps } from './types'
import { useSendScroll } from './useSendScroll'

// "random" function from here: https://stackoverflow.com/a/8084248/3452513
// we do not use uuid since it would add extra native dependency (https://www.npmjs.com/package/react-native-get-random-values)
// lib's user can decide which algorithm to use and pass it as a prop
const defaultMessageIdGenerator = () => (Math.random() + 1).toString(36).substring(7)

// The input's ref may be the app's (a prop), so the compiler cannot tell a `.current` read inside
// a callback from a render input; reading it out here keeps the callback's memoization.
const clearInput = (ref: RefObject<React.ComponentRef<typeof TextInput> | null>) => ref.current?.clear()

// Keep exception handling outside the hook so the React Compiler can optimize its handlers.
function invokeEdit<TMessage extends IMessage> (callback: ((message: TMessage, text: string) => void | Promise<void>) | undefined, message: TMessage, text: string) {
  try {
    return callback?.(message, text)
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * What the composer does: typing, sending (or saving an edit), and the composer element itself,
 * built from the chat's props and the state `useComposerState` holds.
 */
export function useComposerHandlers<TMessage extends IMessage> ({
  props,
  textInputRef,
  messagesContainerRef,
  actionCallbacksRef,
  textStore,
  replyStore,
  editStore,
  getReplyMessage,
  getTextFromProp,
  clearReply,
  notifyDraft,
  restoreDraft,
  stopEdit,
  changeTextRef,
  clearReplyRef,
}: {
  props: ChatProps<TMessage>
  textInputRef: RefObject<React.ComponentRef<typeof TextInput>>
  messagesContainerRef: RefObject<AnimatedList>
  actionCallbacksRef: RefObject<{ onEditMessage?: (message: TMessage, text: string) => void | Promise<void> }>
  textStore: Store<string>
  replyStore: Store<ReplyMessage | null>
  editStore: Store<TMessage | null>
  getReplyMessage: () => ReplyMessage | null
  getTextFromProp: (fallback: string) => string
  clearReply: () => void
  notifyDraft: (draft: string) => void
  restoreDraft: () => void
  stopEdit: () => void
  changeTextRef: RefObject<(text: string) => void>
  clearReplyRef: RefObject<() => void>
}) {
  const {
    messageIdGenerator = defaultMessageIdGenerator,
    user = {},
    onSend,
    textInputProps,
    renderInputToolbar,
    reply,
  } = props

  const replyMessageProp = reply?.message
  const renderReplyPreview = reply?.renderPreview
  const replyPreviewContainerStyle = reply?.previewStyle?.containerStyle
  const replyPreviewTextStyle = reply?.previewStyle?.textStyle

  const requestSendScroll = useSendScroll(props.messages, props.user?._id, messagesContainerRef)

  // The greeting goes out like any typed message; `_onSend` is defined further down.
  const sendRef = useRef<(messages: TMessage[]) => void>(() => {})
  const sendGreeting = useCallback((greeting: string) => {
    sendRef.current([{ text: greeting } as TMessage])
  }, [])

  const notifyInputTextReset = useCallback(() => {
    props.textInputProps?.onChangeText?.('')
  }, [props.textInputProps])

  const resetInputToolbar = useCallback(() => {
    clearInput(textInputRef)

    notifyInputTextReset()

    textStore.set(getTextFromProp(''))
    notifyDraft('')
  }, [
    textStore,
    getTextFromProp,
    textInputRef,
    notifyInputTextReset,
    notifyDraft,
  ])

  const savingEdit = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const _onSend = useCallback(
    (messages: TMessage[] = [], shouldResetInputToolbar = false) => {
      if (!Array.isArray(messages))
        messages = [messages]

      // In edit mode the composer saves the edited text instead of posting a message.
      const [edit] = messages
      const editingMessage = editStore.get()
      if (
        editingMessage &&
        messages.length === 1 &&
        typeof edit?.text === 'string' &&
        !edit.audio &&
        !edit.video
      ) {
        if (savingEdit.current)
          return
        const finish = () => {
          if (!mounted.current || editStore.get() !== editingMessage || textStore.get() !== edit.text)
            return
          if (shouldResetInputToolbar === true)
            resetInputToolbar()
          editStore.set(null)
          restoreDraft()
        }
        const result = invokeEdit(actionCallbacksRef.current.onEditMessage, editingMessage, edit.text)
        if (result && typeof result.then === 'function') {
          savingEdit.current = true
          void result.then(finish, () => {
            // The caller reports the error; keep the editor and its text available for retry.
          }).finally(() => {
            savingEdit.current = false
          })
        } else {
          finish()
        }
        return
      }

      const replyMessage = getReplyMessage()
      const newMessages: TMessage[] = messages.map(message => {
        return {
          ...message,
          user: user!,
          createdAt: new Date(),
          _id: messageIdGenerator?.(),
          // Attach reply message if exists
          ...(replyMessage ? { replyMessage } : {}),
        }
      })

      if (shouldResetInputToolbar === true)
        resetInputToolbar()

      // Clear reply after sending
      clearReply()

      requestSendScroll()
      onSend?.(newMessages)


    },
    [messageIdGenerator, onSend, user, resetInputToolbar, requestSendScroll, getReplyMessage, clearReply, editStore, restoreDraft, actionCallbacksRef, textStore]
  )

  const _onChangeText = useCallback(
    (text: string) => {
      props.textInputProps?.onChangeText?.(text)

      // Only set state if it's not being overridden by a prop.
      if (props.text === undefined || editStore.get())
        textStore.set(text)
      notifyDraft(text)
    },
    [props.text, props.textInputProps, notifyDraft, textStore, editStore]
  )
  useInsertionEffect(() => {
    changeTextRef.current = _onChangeText
    sendRef.current = messages => _onSend(messages, false)
    clearReplyRef.current = () => {
      if (getReplyMessage())
        clearReply()
    }
  })

  // The composer's send keeps one identity: it is an event handler, and a new one each time
  // the app's `onSend` or the reply/edit state changed re-rendered the whole composer.
  const onSendRef = useRef(_onSend)
  useInsertionEffect(() => {
    onSendRef.current = _onSend
  })
  const composerOnSend = useCallback((messages?: TMessage[], shouldResetInputToolbar?: boolean) =>
    onSendRef.current(messages, shouldResetInputToolbar)
  , [])

  const composerTextInputProps = useMemo(() => ({
    ...textInputProps,
    onChangeText: _onChangeText,
    ref: textInputRef,
  }), [textInputProps, _onChangeText, textInputRef])

  const inputToolbarFragment = useMemo(() => {
    const inputToolbarProps = {
      ...props,
      onSend: composerOnSend,
      textInputProps: composerTextInputProps,
      // Reply preview props
      onClearReply: clearReply,
      onCancelEdit: stopEdit,
      renderReplyPreview,
      replyPreviewContainerStyle,
      replyPreviewTextStyle,
    }

    return (
      <ComposerHost
        textStore={textStore}
        controlledText={props.text}
        replyStore={replyStore}
        controlledReply={replyMessageProp}
        editStore={editStore as unknown as Store<IMessage | null>}
        render={renderInputToolbar}
        props={inputToolbarProps}
      />
    )
  }, [
    composerOnSend,
    textStore,
    props,
    renderInputToolbar,
    composerTextInputProps,
    replyStore,
    replyMessageProp,
    clearReply,
    editStore,
    stopEdit,
    renderReplyPreview,
    replyPreviewContainerStyle,
    replyPreviewTextStyle,
  ])

  useEffect(() => {
    if (props.text != null && !editStore.get())
      textStore.set(props.text)
  }, [props.text, textStore, editStore])

  return { inputToolbarFragment, sendGreeting, notifyInputTextReset }
}
