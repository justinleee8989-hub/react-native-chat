import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { StartupScreen } from './StartupScreen'

const mockHide = jest.fn()
jest.mock('expo-splash-screen', () => ({ hide: () => mockHide() }))

jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ bg: '#F4F4F6', text: '#111113', text2: '#6B6B76', text3: '#A3A3AD', accent: '#3366FF' }) }))
it('renders the product mark and a real preparation notice without a countdown', async () => {
  const view = await render(<StartupScreen />)
  expect(mockHide).not.toHaveBeenCalled()
  await fireEvent(view.getByTestId('product-startup'), 'layout', { nativeEvent: { layout: { width: 390, height: 844 } } })
  expect(mockHide).toHaveBeenCalledTimes(1)
  expect(view.getByLabelText('消息')).toBeTruthy()
  expect(view.getByText('正在准备消息…')).toBeTruthy()
  expect(view.getByTestId('product-startup').props.accessibilityViewIsModal).toBe(true)
})
