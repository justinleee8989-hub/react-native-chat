import { PermissionsAndroid, Platform } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react-native'
import { useCallKeepAlive } from './useCallKeepAlive'

jest.mock('../../../modules/call-keep-alive', () => ({ __esModule: true, default: null }))

// An Android build without the module behaves as iOS and the web do, where it is absent too.
it('does nothing where the app has no keep-alive service', async () => {
  const os = Platform.OS
  const version = Platform.Version
  Platform.OS = 'android'
  Object.defineProperty(Platform, 'Version', { value: 34, configurable: true })
  const request = jest.spyOn(PermissionsAndroid, 'request')
  try {
    const { unmount } = await renderHook(() => useCallKeepAlive({ title: 'Alice', microphone: true, camera: true }))
    await unmount()
    expect(request).not.toHaveBeenCalled()
  } finally {
    Platform.OS = os
    Object.defineProperty(Platform, 'Version', { value: version, configurable: true })
    request.mockRestore()
  }
})
