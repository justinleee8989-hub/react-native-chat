import React, { useCallback, useState } from 'react'
import { Keyboard, Platform, Pressable, View } from 'react-native'
import {
  buildAttachmentMessages,
  InputToolbar,
  Send,
  isVoiceRecordingAvailable,
  type IMessage,
  type InputToolbarProps,
  type PickedAttachment,
} from '@kesha-antonov/react-native-chat'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { reportError } from '../../application/store'
import { useProductLayout } from '../../ui/preferences'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductTheme } from '../../ui/theme'
import { ProductReplyPreview } from '../ProductMessageParts'
import { ProductRecording } from '../ProductRecording'
import { EmojiPanel } from './EmojiPanel'
import { styles } from './styles'
import type { ProductInputToolbarProps } from './types'
import { useComposerSize } from './useComposerSize'

export function ProductInputToolbar (props: ProductInputToolbarProps) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const insets = useSafeAreaInsets()
  const keyboard = useReanimatedKeyboardAnimation()
  const noKeyboard = useSharedValue(0)
  const height = keyboard?.height ?? noKeyboard
  const bottom = desktop ? 0 : insets.bottom
  const safeArea = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, bottom - Math.max(0, -height.value)),
  }))
  const [recording, setRecording] = useState(false)
  const composerSize = useComposerSize(props)
  const startRecording = useCallback(() => {
    setPanel(undefined)
    Keyboard.dismiss()
  }, [])
  const canRecord =
    isVoiceRecordingAvailable &&
    props.audioRecording !== false &&
    (typeof props.audioRecording !== 'object' || props.audioRecording.isEnabled !== false)
  const [panelWidth, setPanelWidth] = useState(360)
  const [panel, setPanel] = useState<'more' | 'emoji'>()
  const dispatch = (message: Partial<IMessage> | Partial<IMessage>[], reset: boolean) => {
    const onSend = (
      props as InputToolbarProps<IMessage> & {
        onSend?: (message: Partial<IMessage> | Partial<IMessage>[], reset: boolean) => void
      }
    ).onSend
    onSend?.(message, reset)
    setPanel(current => (current === 'more' ? undefined : current))
  }
  const attachments = typeof props.attachments === 'object' ? props.attachments : undefined
  const toggle = (next: 'more' | 'emoji') => {
    Keyboard.dismiss()
    setPanel(current => (current === next ? undefined : next))
  }
  const send = (picks: PickedAttachment[], caption = '') => {
    void (async () => {
      const result = await attachments?.onPick?.(picks, { caption })
      if (result === null)
        return
      const messages = Array.isArray(result) ? result : buildAttachmentMessages(picks, caption)
      const onSend = (
        props as InputToolbarProps<IMessage> & {
          onSend?: (messages: Partial<IMessage>[], reset: boolean) => void
        }
      ).onSend
      if (messages.length)
        onSend?.(messages, false)
    })().catch(reportError)
  }
  const contextMessage = props.editMessage || props.replyMessage
  return (
    <Animated.View
      testID='product-composer'
      pointerEvents={props.accessPending ? 'none' : 'auto'}
      accessibilityState={{ busy: !!props.accessPending }}
      style={[styles.container, { backgroundColor: t.bg, borderColor: t.line }, safeArea]}
    >
      {!recording && contextMessage && (
        <ProductReplyPreview
          replyMessage={contextMessage}
          mode={props.editMessage ? 'edit' : 'reply'}
          selfID={props.selfID}
          onClearReply={props.editMessage ? props.onCancelEdit : props.onClearReply}
        />
      )}
      <View style={styles.content}>
        <View style={{ display: recording ? 'none' : 'flex' }}>
          <InputToolbar
            {...props}
            bottomInset={0}
            audioRecording={false}
            videoRecording={false}
            renderReplyPreview={() => null}
            actionsPosition='leading'
            containerStyle={[styles.content, {
              paddingTop: desktop ? 12 : 8,
              paddingBottom: desktop ? 14 : 8,
              paddingLeft: desktop ? 20 : 8,
              paddingRight: desktop ? 20 : 8,
              minHeight: desktop ? 66 : 56,
            }]}
            attachments={false}
            emojiKeyboard={false}
            renderSend={sendProps =>
              canRecord && !props.text?.trim() && !props.editMessage ? (
                <View style={styles.sendPlaceholder} />
              ) : (
                <Send
                  {...sendProps}
                  containerStyle={
                    props.text?.trim()
                      ? styles.sendButton
                      : undefined
                  }
                  onSend={dispatch}
                  sendButtonProps={{ accessibilityLabel: '发送' }}
                />
              )
            }
            onPressEmoji={() => toggle('emoji')}
            renderActions={() => (
              <Pressable
                accessibilityRole='button'
                accessibilityLabel='更多附件'
                onPress={() => toggle('more')}
                style={[styles.actionButton, {
                  transform: [{ rotate: panel === 'more' ? '45deg' : '0deg' }],
                }]}
              >
                <ProductIcon name='plus' size={26} color={t.text2} />
              </Pressable>
            )}
            textInputProps={
              {
                ...props.textInputProps,
                editable: props.accessPending ? false : props.textInputProps?.editable,
                ...composerSize,
                onKeyPress: event => {
                  props.textInputProps?.onKeyPress?.(event)
                  const key = event.nativeEvent as typeof event.nativeEvent & {
                    shiftKey?: boolean
                    isComposing?: boolean
                    keyCode?: number
                  }
                  if (
                    Platform.OS === 'web' &&
                    key.key === 'Enter' &&
                    !key.shiftKey &&
                    !key.isComposing &&
                    key.keyCode !== 229
                  ) {
                    event.preventDefault()
                    if (props.text?.trim())
                      dispatch({ text: props.text.trim() }, true)
                  }
                },
                onFocus: event => {
                  setPanel(undefined)
                  props.textInputProps?.onFocus?.(event)
                },
              } as InputToolbarProps<IMessage>['textInputProps']
            }
          />
        </View>
        {canRecord && (
          <ProductRecording
            config={typeof props.audioRecording === 'object' ? props.audioRecording : undefined}
            onSend={dispatch}
            onActiveChange={setRecording}
            onStart={startRecording}
            idleVisible={!props.text?.trim() && !props.editMessage}
          />
        )}
      </View>
      {attachments?.renderAttachmentMenu?.({
        visible: panel === 'more',
        onClose: () => setPanel(undefined),
        tabs: attachments.tabs || ['gallery', 'camera', 'file'],
        onSend: send,
      })}
      {panel === 'emoji' && (
        <EmojiPanel
          panelWidth={panelWidth}
          setPanelWidth={setPanelWidth}
          text={props.text}
          onChangeText={props.textInputProps?.onChangeText}
        />
      )}
    </Animated.View>
  )
}
