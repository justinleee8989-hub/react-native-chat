import React from 'react'
import { AppState } from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { scanQRInPhoto } from '../application/scan-photo'
import { showProductToast } from '../shared/ProductToast'
import ScanScreen from './ScanScreen'

const mockReplace = jest.fn()
let mockScanned: ((value: string) => void) | undefined
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => {
  const ReactModule = require('react')
  return {
    useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
    // Focused at once, as when the page is pushed.
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(effect, [effect]),
  }
})
jest.mock('./QRScanner', () => ({
  QRScanner: ({ onScanned }: { onScanned: (value: string) => void }) => {
    mockScanned = onScanned
    return null
  },
}))
jest.mock('../application/scan-photo', () => ({ scanQRInPhoto: jest.fn() }))
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null, showProductToast: jest.fn() }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))

beforeEach(() => {
  mockScanned = undefined
  // resetMocks clears React Native's mocked listener, which then returns nothing to remove.
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never)
})

it('opens the profile of a scanned 我的二维码 code, once however often it is read', async () => {
  await render(<ScanScreen />)
  mockScanned?.('example:///chats/people/bob')
  mockScanned?.('example:///chats/people/bob')
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/chats/people/bob')
})

it('says a code is not a friend code, not on every frame it stays in view', async () => {
  await render(<ScanScreen />)
  mockScanned?.('https://example.com')
  mockScanned?.('https://example.com')
  expect(showProductToast).toHaveBeenCalledTimes(1)
  expect(showProductToast).toHaveBeenCalledWith('不是好友二维码')
  expect(mockReplace).not.toHaveBeenCalled()
})

it('reads a code from an album photo, and says when the photo has none', async () => {
  jest.mocked(scanQRInPhoto).mockResolvedValueOnce('')
  await render(<ScanScreen />)
  await fireEvent.press(screen.getByRole('button', { name: '从相册选择二维码' }))
  await waitFor(() => expect(showProductToast).toHaveBeenCalledWith('图片中没有识别到二维码'))
  jest.mocked(scanQRInPhoto).mockResolvedValueOnce('example:///chats/people/carol')
  await fireEvent.press(screen.getByRole('button', { name: '从相册选择二维码' }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/chats/people/carol'))
})
