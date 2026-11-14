import { Platform } from 'react-native'
import type { ServerConfig } from './domain/types'

export const platformID = Platform.OS === 'web' ? 5 : Platform.OS === 'ios' ? 1 : 2
export const defaultConfig: ServerConfig = {
  chat: process.env.EXPO_PUBLIC_OPENIM_CHAT_URL || 'http://127.0.0.1:10008',
  api: process.env.EXPO_PUBLIC_OPENIM_API_URL || 'http://127.0.0.1:10002',
  ws: process.env.EXPO_PUBLIC_OPENIM_WS_URL || 'ws://127.0.0.1:10001',
}
