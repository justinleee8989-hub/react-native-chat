import { Stack } from 'expo-router'
import ProductShell from '@/features/im/navigation/ProductShell'

// The chat list's screens draw their own header, so the stack shows none.
export default function ChatsLayout () {
  return <ProductShell><Stack screenOptions={{ headerShown: false }} activityEnabled><Stack.Screen name='call' options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} /></Stack></ProductShell>
}
