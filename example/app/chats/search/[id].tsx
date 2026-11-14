import { useLocalSearchParams } from 'expo-router'
import HistorySearchScreen from '@/features/im/messages/HistorySearchScreen'

export default function SearchRoute () {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <HistorySearchScreen id={id} />
}
