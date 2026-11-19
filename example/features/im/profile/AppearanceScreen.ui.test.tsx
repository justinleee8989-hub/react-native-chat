import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { setChatTheme, setProductAppearance } from '../ui/preferences'
import AppearanceScreen from './AppearanceScreen'

const mockOpenMaster = jest.fn()
let mockScheme: 'light' | 'dark' = 'light'
let mockAppearance = 'auto'
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto',
  setChatTheme: jest.fn(),
  setProductAppearance: jest.fn(),
  useChatTheme: () => 'classic',
  useChatWallpaper: () => 'mint',
  useProductAppearance: () => mockAppearance,
  useProductLayout: () => ({ desktop: false }),
  useProductScheme: () => mockScheme,
}))
jest.mock('../navigation/DesktopNavigation', () => ({ useMasterNavigation: () => mockOpenMaster }))
jest.mock('../ui/ProductPage', () => {
  const { Text, View } = require('react-native')
  return {
    ProductPage: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
    ProductSection: ({ children }: React.PropsWithChildren) => <Text>{children}</Text>,
  }
})
jest.mock('../ui/ChatAppearancePreview', () => {
  const { Text } = require('react-native')
  return { ChatAppearancePreview: ({ wallpaper, theme }: { wallpaper: string, theme: string }) => <Text>{`预览:${theme}:${wallpaper}`}</Text> }
})
jest.mock('../ui/ChatWallpaperView', () => ({ ChatWallpaperOf: () => null }))
jest.mock('../ui/ProductIcon', () => {
  const { Text } = require('react-native')
  return { ProductIcon: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> }
})

beforeEach(() => {
  mockScheme = 'light'
  mockAppearance = 'auto'
})

it('previews the current theme over the current wallpaper and opens 聊天壁纸', async () => {
  await render(<AppearanceScreen />)
  expect(screen.getByText('预览:classic:mint')).toBeTruthy()
  expect(screen.getByRole('radio', { name: '经典' }).props.accessibilityState).toMatchObject({ checked: true })
  await fireEvent.press(screen.getByRole('radio', { name: '海洋' }))
  expect(setChatTheme).toHaveBeenCalledWith('ocean')
  await fireEvent.press(screen.getByText('聊天壁纸'))
  expect(mockOpenMaster).toHaveBeenCalledWith('/chats/chat-wallpaper')
})

it('offers 浅色 and 深色 only once 跟随系统 is off', async () => {
  const view = await render(<AppearanceScreen />)
  expect(screen.queryByText('浅色')).toBeNull()
  expect(screen.queryByText('深色')).toBeNull()
  // Turned off, it keeps the scheme on screen.
  mockScheme = 'dark'
  await view.rerender(<AppearanceScreen />)
  await fireEvent.press(screen.getByRole('switch', { name: '跟随系统' }))
  expect(setProductAppearance).toHaveBeenCalledWith('dark')
  mockAppearance = 'dark'
  await view.rerender(<AppearanceScreen />)
  await fireEvent.press(screen.getByText('浅色'))
  expect(setProductAppearance).toHaveBeenCalledWith('light')
})

it('marks the fixed scheme and turns following the system back on', async () => {
  mockAppearance = 'light'
  await render(<AppearanceScreen />)
  expect(screen.getAllByText('icon:check')).toHaveLength(1)
  await fireEvent.press(screen.getByRole('switch', { name: '跟随系统' }))
  expect(setProductAppearance).toHaveBeenCalledWith('auto')
})
