import { useLocalSearchParams } from 'expo-router'

import ChatScreen from '@/features/im/messages/ChatScreen'

export default function ChatRoute () {
  const { id, messageID } = useLocalSearchParams<{ id: string, messageID?: string }>()
  return <ChatScreen key={id} id={id} messageID={messageID} />
}
