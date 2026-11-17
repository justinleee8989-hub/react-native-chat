import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { ProductMessageImage, ProductMessageText, ProductReactions, ProductReplyPreview } from './ProductMessageParts'

jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', onAccent: '#fff', accent: '#06f', accentWeak: '#eef', danger: '#f00' }) }))
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: { children: React.ReactNode }) => children, useTapGesture: (options: unknown) => options }))
jest.mock('@kesha-antonov/react-native-chat', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  const actual = jest.requireActual<any>('@kesha-antonov/react-native-chat')
  return {
    ...actual,
    MessageImage: ({ currentMessage, imageStyle }: { currentMessage: { image?: string }, imageStyle?: object }) => ReactModule.createElement(Native.View, { testID: 'sdk-message-image', accessibilityLabel: currentMessage.image, style: imageStyle }),
    MessageText: ({ currentMessage, onPress, trailing }: { currentMessage: { text: string }, onPress?: (message: unknown, url: string, type: string) => void, trailing?: React.ReactNode }) => ReactModule.createElement(Native.Pressable, { accessibilityRole: 'link', onPress: () => onPress?.(currentMessage, 'https://example.com', 'url') }, ReactModule.createElement(Native.Text, null, currentMessage.text), trailing),
  }
})

it('keeps the actual edited message and SDK link callback', async () => {
  const message = { _id: 'message-17', text: 'https://example.com', createdAt: new Date(), user: { _id: 'me' }, isEdited: true }
  const onPress = jest.fn()
  const view = await render(<ProductMessageText currentMessage={message} position='right' onPress={onPress} />)
  await fireEvent.press(view.getByRole('link'))
  expect(onPress).toHaveBeenCalledWith(message, 'https://example.com', 'url')
  expect(view.getByText(message.text)).toBeTruthy()
  const editedLabel = view.getByLabelText('已编辑')
  expect(editedLabel.props.children).toBe('　已\u2060编\u2060辑')
})

it('uses the SDK gallery image path and sizes portrait and landscape photos', async () => {
  const portraitMessage = { _id: 'p', text: '', createdAt: new Date(), user: { _id: 'a' }, image: 'https://example.com/portrait.jpg', imageWidth: 170, imageHeight: 220 } as any
  const portrait = await render(<ProductMessageImage currentMessage={portraitMessage} position='left' />)
  expect(portrait.getByTestId('sdk-message-image').props.accessibilityLabel).toBe('https://example.com/portrait.jpg')
  expect(portrait.getByTestId('sdk-message-image').props.style).toEqual(expect.objectContaining({ width: 170, height: 220 }))
  const landscapeMessage = { _id: 'l', text: '', createdAt: new Date(), user: { _id: 'a' }, image: 'https://example.com/landscape.jpg', imageWidth: 210, imageHeight: 150 } as any
  const landscape = await render(<ProductMessageImage currentMessage={landscapeMessage} position='left' />)
  expect(landscape.getByTestId('sdk-message-image').props.accessibilityLabel).toBe('https://example.com/landscape.jpg')
  expect(landscape.getByTestId('sdk-message-image').props.style).toEqual(expect.objectContaining({ width: 210, height: 150 }))
})

it('renders an image when the next-message neighbor is an empty object', async () => {
  const currentMessage = { _id: 'image', text: '', createdAt: new Date(), user: { _id: 'author' }, image: 'https://example.com/image.jpg' }
  const view = await render(<ProductMessageImage {...{ currentMessage, nextMessage: {}, position: 'left' } as any} />)

  expect(view.getByTestId('sdk-message-image').props.accessibilityLabel).toBe(currentMessage.image)
})

it('filters empty reaction user ids, shows counts and selected styling, and forwards emoji taps', async () => {
  const onReactionPress = jest.fn()
  const view = await render(<ProductReactions message={{ _id: 'm', text: '', createdAt: new Date(), user: { _id: 'me' } }} reactions={[{ emoji: '👍', userIds: [] }, { emoji: '❤️', userIds: ['me', 'peer'] }]} currentUserId='me' position='right' onReactionPress={onReactionPress} />)
  expect(view.queryByText('👍')).toBeNull()
  expect(view.getByText('2')).toBeTruthy()
  const selected = view.getByRole('button', { name: /❤️/ })
  expect(selected.props.accessibilityState?.selected).toBe(true)
  await fireEvent.press(selected)
  expect(onReactionPress).toHaveBeenCalledWith('❤️')
})

it('shows localized edit and reply previews, media fallbacks, and clears through the supplied callback', async () => {
  const onClearReply = jest.fn()
  const message = { _id: 'reply', text: '', user: { _id: 'self', name: '自己' } }
  const view = await render(<ProductReplyPreview replyMessage={message} mode='edit' selfID='self' onClearReply={onClearReply} />)
  expect(view.getByText('编辑消息')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: '取消' }))
  expect(onClearReply).toHaveBeenCalledTimes(1)

  await view.rerender(<ProductReplyPreview replyMessage={{ ...message, user: { _id: 'peer', name: '重构验收B' }, image: 'photo' }} mode='reply' selfID='self' onClearReply={onClearReply} />)
  expect(view.getByText('回复 重构验收B')).toBeTruthy()
  expect(view.getByText('[图片]')).toBeTruthy()
  await view.rerender(<ProductReplyPreview replyMessage={{ ...message, text: '自己发的' }} mode='reply' selfID='self' />)
  expect(view.getByText('回复 自己')).toBeTruthy()
  await view.rerender(<ProductReplyPreview replyMessage={{ ...message, audio: 'voice' }} mode='reply' selfID='self' />)
  expect(view.getByText('[语音]')).toBeTruthy()
  await view.rerender(<ProductReplyPreview replyMessage={{ ...message, file: { uri: 'file:///a', name: '方案.pdf' } } as any} mode='reply' selfID='self' />)
  expect(view.getByText('[文件] 方案.pdf')).toBeTruthy()
})
