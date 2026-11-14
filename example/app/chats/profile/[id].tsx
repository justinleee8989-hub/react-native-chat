import { useLocalSearchParams } from 'expo-router'

import ConversationAssetsScreen from '@/features/im/messages/ConversationAssetsScreen'

/** Compatibility route for older links; this now shows real OpenIM conversation assets. */
export default function ProfileRoute () {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ConversationAssetsScreen id={id} />
}
