import React from 'react'
import { Linking } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ProductFile } from './ProductFile'
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', onAccent: '#fff', accent: '#06f', accentWeak: '#eef', danger: '#f00' }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: { children: React.ReactNode }) => children, useTapGesture: (options: unknown) => options }))
it('opens the original attachment and surfaces download failures', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('offline'))
  const view = await render(<ProductFile currentMessage={{ _id: 'file-id', text: '', createdAt: new Date(), user: { _id: 'me' }, file: { uri: 'http://127.0.0.1:10005/file.txt', name: '验收.txt', size: 91 } }} position='right' />)
  await fireEvent(view.getByRole('button'), 'accessibilityTap')
  expect(Linking.openURL).toHaveBeenCalledWith('http://127.0.0.1:10005/file.txt')
  await waitFor(() => expect(view.getByText('文件暂时无法打开，请重试')).toBeTruthy())
})

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }))
it('uses the native share sheet for an on-device attachment', async () => {
  const { isAvailableAsync, shareAsync } = require('expo-sharing')
  isAvailableAsync.mockResolvedValue(true)
  shareAsync.mockResolvedValue(undefined)
  const view = await render(<ProductFile currentMessage={{ _id: 'local-file', text: '', createdAt: new Date(), user: { _id: 'me' }, file: { uri: 'file:///local/qa.txt', name: 'qa.txt', mimeType: 'text/plain' } }} />)
  await fireEvent(view.getByRole('button'), 'accessibilityTap')
  await waitFor(() => expect(shareAsync).toHaveBeenCalledWith('file:///local/qa.txt', { mimeType: 'text/plain', dialogTitle: 'qa.txt' }))
})
