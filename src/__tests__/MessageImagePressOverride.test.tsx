import React from 'react'
import { act, fireEvent } from '@testing-library/react-native'
import { MessageImage } from '../MessageImage'
import { render } from './renderWithGestureRoot'

let mockGallery: { open: jest.Mock }
jest.mock('../components/mediaViewer/gallery', () => ({ useMediaGallery: () => mockGallery }))
jest.mock('../components/mediaViewer/MediaViewer', () => ({ MediaViewer: () => null }))
jest.mock('../components/TouchableOpacity', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  return { TouchableOpacity: ({ children, ...props }: any) => ReactModule.createElement(Native.Pressable, props, children) }
})

const message = { _id: 'photo-1', text: '', createdAt: new Date(), user: { _id: 'author' }, image: 'https://example.com/photo.jpg' }

beforeEach(() => {
  mockGallery = { open: jest.fn() }
})

it('uses the optional image callback only after loading, preserving the SDK gallery default', async () => {
  const onPressImage = jest.fn()
  const view = await render(<MessageImage {...{ currentMessage: message, onPressImage } as any} />)
  await act(async () => view.getByTestId('message-image').props.onLoad())
  await fireEvent.press(view.getByTestId('message-image-touchable'))
  expect(onPressImage).toHaveBeenCalledWith(message)
  expect(mockGallery.open).not.toHaveBeenCalled()

  const defaultView = await render(<MessageImage currentMessage={message} />)
  await act(async () => defaultView.getByTestId('message-image').props.onLoad())
  await fireEvent.press(defaultView.getByTestId('message-image-touchable'))
  expect(mockGallery.open).toHaveBeenCalledWith('photo-1')
})
