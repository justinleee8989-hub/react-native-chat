import { useLocalSearchParams } from 'expo-router'
import MessageReadersScreen from '@/features/im/messages/MessageReadersScreen'

export default function ReadersRoute () {
  const { id, messageID, seq } = useLocalSearchParams<{ id: string, messageID: string, seq: string }>()
  return <MessageReadersScreen id={id} messageID={messageID} seq={Number(seq)} />
}
