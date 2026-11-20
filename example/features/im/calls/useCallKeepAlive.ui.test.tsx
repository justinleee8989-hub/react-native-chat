import { PermissionsAndroid, Platform } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react-native'
import { useCallKeepAlive } from './useCallKeepAlive'

jest.mock('../../../modules/call-keep-alive', () => ({ __esModule: true, default: { start: jest.fn(() => true), stop: jest.fn() } }))
const mockService = jest.requireMock<{ default: { start: jest.Mock, stop: jest.Mock } }>('../../../modules/call-keep-alive').default

it('runs the service for the call, updates it with the camera, asks for notifications once and stops with the call', async () => {
  const os = Platform.OS
  const version = Platform.Version
  Platform.OS = 'android'
  Object.defineProperty(Platform, 'Version', { value: 34, configurable: true })
  const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false)
  const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED)
  try {
    const call = { title: 'Alice', microphone: true, camera: false }
    const { rerender, unmount } = await renderHook((props?: typeof call) => useCallKeepAlive(props), { initialProps: undefined as typeof call | undefined })
    expect(mockService.start).not.toHaveBeenCalled()
    await rerender(call)
    // Started, then again once notifications are allowed, so its notification shows.
    expect(mockService.start).toHaveBeenCalledTimes(2)
    expect(mockService.start).toHaveBeenLastCalledWith('Alice', expect.any(String), expect.any(String), false)
    expect(request).toHaveBeenCalledTimes(1)
    await rerender({ ...call, camera: true })
    expect(mockService.start).toHaveBeenLastCalledWith('Alice', expect.any(String), expect.any(String), true)
    expect(request).toHaveBeenCalledTimes(1)
    expect(mockService.stop).not.toHaveBeenCalled()
    await rerender(undefined)
    expect(mockService.stop).toHaveBeenCalledTimes(1)
    await rerender(call)
    await unmount()
    expect(mockService.stop).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledTimes(1)
  } finally {
    Platform.OS = os
    Object.defineProperty(Platform, 'Version', { value: version, configurable: true })
    check.mockRestore()
    request.mockRestore()
  }
})
