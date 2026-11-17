import { Stack } from 'expo-router'
import { useEntryExperiments } from '@/features/im/navigation/entry-experiments'
import ProductShell from '@/features/im/navigation/ProductShell'

// The chat list's screens draw their own header, so the stack shows none.
export default function ChatsLayout () {
  // `activityEnabled` stays on unless the diagnostic build switches it off (entry-experiments).
  const { activity } = useEntryExperiments()
  return <ProductShell><Stack screenOptions={{ headerShown: false }} activityEnabled={activity === 'on'}><Stack.Screen name='call' options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} /></Stack></ProductShell>
}
