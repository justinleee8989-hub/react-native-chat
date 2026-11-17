import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { ProductQuote } from './ProductQuote'
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', onAccent: '#fff' }) }))
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: { children: React.ReactNode }) => children, useTapGesture: (options: unknown) => options }))
it('keeps the actual quoted author and forwards both original messages when opened', async () => {
  const onPress = jest.fn()
  const replyMessage = { _id: 'quoted', text: '原消息', user: { _id: 'peer', name: '重构验收B' } }
  const currentMessage = { _id: 'reply', text: '回复', createdAt: new Date(), user: replyMessage.user }
  const view = await render(<ProductQuote replyMessage={replyMessage} currentMessage={currentMessage} position='left' onPress={onPress} />)
  expect(view.getByText('重构验收B')).toBeTruthy()
  expect(view.queryByText('You')).toBeNull()
  await fireEvent(view.getByRole('button'), 'accessibilityTap')
  expect(onPress).toHaveBeenCalledWith(replyMessage, currentMessage)
})
it('retains file names and video labels in non-text quotes', async () => {
  const currentMessage = { _id: 'reply', text: '回复', createdAt: new Date(), user: { _id: 'me' } }
  const file = { _id: 'file', text: '', user: { _id: 'peer' }, file: { uri: 'https://example.com/a', name: '方案.pdf' } }
  const view = await render(<ProductQuote replyMessage={file} currentMessage={currentMessage} position='left' />)
  expect(view.getByText('[文件] 方案.pdf')).toBeTruthy()
  const video = { _id: 'video', text: '', user: { _id: 'peer' }, video: 'https://example.com/v' }
  await view.rerender(<ProductQuote replyMessage={video} currentMessage={currentMessage} position='left' />)
  expect(view.getByText('[视频]')).toBeTruthy()
})
