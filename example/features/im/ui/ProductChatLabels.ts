import type { ChatLabels } from '@kesha-antonov/react-native-chat'

import type { Translate } from '../i18n/translate.ts'

/** The app's wording over the chat library's own, in the current language. */
export function productChatLabels (tr: Translate): Partial<ChatLabels> {
  return {
    recordAudioMessage: tr('chat.recordVoice'),
    recordVideoMessage: tr('chat.recordVideo'),
  }
}
