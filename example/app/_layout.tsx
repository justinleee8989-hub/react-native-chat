import { LogBox, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import 'react-native-reanimated'

import CallOverlay from '@/features/im/calls/CallOverlay'
import { ProductFrame } from '@/features/im/navigation/ProductShell'
import SessionGuard from '@/features/im/navigation/SessionGuard'
import { StartupReadinessProvider } from '@/features/im/navigation/StartupReadiness'
import { useColorScheme } from '@/hooks/use-color-scheme'

// Hand off to the first laid-out app frame without a white fade covering ready content.
SplashScreen.setOptions({ fade: false, duration: 0 })
void SplashScreen.preventAutoHideAsync()

LogBox.ignoreLogs(['Open debugger to view warnings'])

export default function RootLayout () {
  const colorScheme = useColorScheme()

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Apps are expected to mount KeyboardProvider once, at the root.
          Chat detects it and does not mount a second one. */}
      <KeyboardProvider>
        <StartupReadinessProvider><ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* A screen covered by another stops rendering but keeps its state (React Activity):
              the tabs, and the chat list in them, do no work while a chat is open on top. */}
          <ProductFrame><Stack screenOptions={{ headerShown: false }} activityEnabled>
            <Stack.Screen name='(tabs)' />
            <Stack.Screen name='auth' />
            <Stack.Screen name='chat' />
            <Stack.Screen name='explore' />
            <Stack.Screen name='chats' />
            <Stack.Screen name='modal' options={{ headerShown: true, presentation: 'modal', title: 'Modal' }} />
          </Stack></ProductFrame>
          <CallOverlay />
          <SessionGuard />
          <StatusBar style='auto' />
        </ThemeProvider></StartupReadinessProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
