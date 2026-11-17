import { Stack } from 'expo-router'
import { chatPushAnimation } from '@/features/im/navigation/chat-transition'
import ProductShell from '@/features/im/navigation/ProductShell'

// The chat list's screens draw their own header, so the stack shows none.
export default function ChatsLayout () {
  return <ProductShell><Stack screenOptions={{ headerShown: false, animation: chatPushAnimation }} activityEnabled><Stack.Screen name='call' options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} /></Stack></ProductShell>
}
