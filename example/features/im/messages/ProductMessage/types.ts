import type { IMessage, MessageProps } from '@kesha-antonov/react-native-chat'

export type ProductMessageProps = MessageProps<IMessage> & {
  containerWidth?: number
  lastOwnID?: string
  readCount?: number
  group: boolean
  onReaders: (message: IMessage) => void
  onRetry?: (message: IMessage) => void
}
