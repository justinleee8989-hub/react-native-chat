import { useLocalSearchParams } from 'expo-router'
import ConversationAssetsScreen from '@/features/im/messages/ConversationAssetsScreen'

export default function ConversationAssetsRoute () {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ConversationAssetsScreen id={id} />
}
