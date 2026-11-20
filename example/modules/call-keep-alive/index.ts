import { AppRegistry, Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

// The Android foreground service that keeps a call going in the background. Absent on iOS, where
// the call's audio session does this, and on the web.
type CallKeepAlive = {
  start(title: string, text: string, channel: string, camera: boolean): boolean
  stop(): void
}

const CallKeepAlive = requireOptionalNativeModule<CallKeepAlive>('CallKeepAlive')
// While the service runs it holds this task open, so React Native keeps the app's timers running
// in the background; the service ends it, so it never settles here.
if (CallKeepAlive && Platform.OS === 'android')
  AppRegistry.registerHeadlessTask('CallKeepAlive', () => () => new Promise<void>(() => {}))

export default CallKeepAlive
