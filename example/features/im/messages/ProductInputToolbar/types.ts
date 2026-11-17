import type { Ref } from 'react'
import type { TextInputProps } from 'react-native'
import type { IMessage, InputToolbarProps } from '@kesha-antonov/react-native-chat'

export type ProductInputToolbarProps = InputToolbarProps<IMessage> & { selfID?: string, accessPending?: boolean }

export interface ComposerInputNode {
  style?: { height: string }
  scrollHeight?: number
  getNativeRef?: () => ComposerInputNode | null
}

export interface EmojiPanelProps {
  panelWidth: number
  setPanelWidth: (width: number) => void
  text?: string
  onChangeText?: (text: string) => void
}

export interface ComposerSize extends Pick<TextInputProps, 'style' | 'onLayout' | 'onContentSizeChange'> {
  ref: Ref<unknown>
}
