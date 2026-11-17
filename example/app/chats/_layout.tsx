import { Stack } from 'expo-router'
import { useEntryExperiments } from '@/features/im/navigation/entry-experiments'
import ProductShell from '@/features/im/navigation/ProductShell'

// The chat list's screens draw their own header, so the stack shows none.
export default function ChatsLayout () {
  // `activityEnabled` and the push animation keep their defaults unless the diagnostic build
  // switches them (entry-experiments).
  const { activity, animation } = useEntryExperiments()
  return <ProductShell><Stack screenOptions={{ headerShown: false, animation }} activityEnabled={activity === 'on'}><Stack.Screen name='call' options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} /></Stack></ProductShell>
}
