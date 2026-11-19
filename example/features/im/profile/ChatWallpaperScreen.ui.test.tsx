import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { chooseWallpaperPhoto, forgetWallpaperPhoto, WallpaperPhotoTooLarge } from '../application/chat-wallpaper-photo'
import { showProductToast } from '../shared/ProductToast'
import { setChatWallpaper, setChatWallpaperPhoto } from '../ui/preferences'
import ChatWallpaperScreen from './ChatWallpaperScreen'

const mockOpenMaster = jest.fn()
let mockWallpaper = 'plain'
let mockPhoto = ''
jest.mock('../ui/preferences', () => ({
  setChatWallpaper: jest.fn(),
  setChatWallpaperPhoto: jest.fn(),
  useChatWallpaper: () => mockWallpaper,
  useChatWallpaperPhoto: () => mockPhoto,
  useProductLayout: () => ({ desktop: false }),
  useProductScheme: () => 'light',
}))
jest.mock('../application/chat-wallpaper-photo', () => ({ chooseWallpaperPhoto: jest.fn(), forgetWallpaperPhoto: jest.fn(), WallpaperPhotoTooLarge: class extends Error {} }))
jest.mock('../shared/ProductToast', () => ({ showProductToast: jest.fn() }))
jest.mock('../navigation/DesktopNavigation', () => ({ useMasterNavigation: () => mockOpenMaster }))
jest.mock('../ui/ProductPage', () => {
  const { View } = require('react-native')
  return { ProductPage: ({ children }: React.PropsWithChildren) => <View>{children}</View> }
})
jest.mock('../ui/ChatWallpaperView', () => ({ ChatWallpaperOf: () => null, ChatWallpaperView: () => null }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))

beforeEach(() => {
  mockWallpaper = 'plain'
  mockPhoto = ''
})

it('lists 默认 and the gradients, marks the current one, and opens 设置颜色', async () => {
  mockWallpaper = 'mint'
  await render(<ChatWallpaperScreen />)
  expect(screen.getAllByRole('radio').map(item => item.props.accessibilityLabel)).toEqual(['默认', '经典', '蓝紫', '薄荷', '晨曦', '樱粉'])
  expect(screen.getByRole('radio', { name: '薄荷' }).props.accessibilityState).toMatchObject({ checked: true })
  await fireEvent.press(screen.getByRole('radio', { name: '晨曦' }))
  expect(setChatWallpaper).toHaveBeenCalledWith('dawn')
  await fireEvent.press(screen.getByText('设置颜色'))
  expect(mockOpenMaster).toHaveBeenCalledWith('/chats/chat-wallpaper-colors')
})

it('keeps a picked photo, replacing the one before it, and makes it the wallpaper', async () => {
  mockPhoto = 'file:///old.jpg'
  jest.mocked(chooseWallpaperPhoto).mockResolvedValue('file:///new.jpg')
  await render(<ChatWallpaperScreen />)
  expect(screen.getAllByRole('radio')[0].props.accessibilityLabel).toBe('相册图片')
  await fireEvent.press(screen.getByText('更换相册图片'))
  await waitFor(() => expect(setChatWallpaper).toHaveBeenCalledWith('photo'))
  expect(forgetWallpaperPhoto).toHaveBeenCalledWith('file:///old.jpg')
  expect(setChatWallpaperPhoto).toHaveBeenCalledWith('file:///new.jpg')
})

it('changes nothing when the album is closed without a choice', async () => {
  jest.mocked(chooseWallpaperPhoto).mockResolvedValue(undefined)
  await render(<ChatWallpaperScreen />)
  await fireEvent.press(screen.getByText('从相册选择'))
  await waitFor(() => expect(chooseWallpaperPhoto).toHaveBeenCalled())
  expect(setChatWallpaperPhoto).not.toHaveBeenCalled()
  expect(setChatWallpaper).not.toHaveBeenCalled()
})

it('removing the photo in use goes back to 默认', async () => {
  mockPhoto = 'file:///old.jpg'
  mockWallpaper = 'photo'
  await render(<ChatWallpaperScreen />)
  await fireEvent.press(screen.getByText('移除相册图片'))
  expect(forgetWallpaperPhoto).toHaveBeenCalledWith('file:///old.jpg')
  expect(setChatWallpaperPhoto).toHaveBeenCalledWith('')
  expect(setChatWallpaper).toHaveBeenCalledWith('plain')
})

it('says a photo is too large to keep, and keeps the current wallpaper', async () => {
  jest.mocked(chooseWallpaperPhoto).mockRejectedValue(new WallpaperPhotoTooLarge())
  await render(<ChatWallpaperScreen />)
  await fireEvent.press(screen.getByText('从相册选择'))
  await waitFor(() => expect(showProductToast).toHaveBeenCalledWith('图片太大，请换一张试试'))
  expect(setChatWallpaperPhoto).not.toHaveBeenCalled()
})
