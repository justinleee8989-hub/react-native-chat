import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ProductChatRow } from './ProductChatRow'

jest.mock('@kesha-antonov/react-native-chat', () => ({
  ...jest.requireActual<object>('@kesha-antonov/react-native-chat'),
  useLabels: () => ({}),
  getChatPreview: (chat: { lastMessage?: { text?: string } }) => ({ text: chat.lastMessage?.text ?? '' }),
}))
jest.mock('../ui/primitives', () => ({ ProductAvatar: () => null }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))

const noop = () => {}

it('reads the whole row to a screen reader: name, preview, time and unread count', async () => {
  const chat = {
    id: 'bob',
    title: 'Bob',
    unreadCount: 3,
    lastMessage: { _id: 'm1', text: '晚上见', createdAt: new Date(2026, 10, 20, 9, 5).getTime(), user: { _id: 'bob' } },
  }
  const view = await render(
    <ProductChatRow chat={chat as never} selected={false} selecting={false} active={false} onPress={noop} onMenu={noop} />
  )
  const label = view.getByRole('button').props.accessibilityLabel as string
  const parts = label.split(', ')
  expect(parts[0]).toBe('Bob')
  expect(parts[1]).toBe('晚上见')
  expect(parts).toHaveLength(4)
  expect(parts[3]).toBe('3 条未读')
})

it('leaves out the unread part when everything is read', async () => {
  const chat = { id: 'bob', title: 'Bob', unreadCount: 0, lastMessage: { _id: 'm1', text: 'ok', createdAt: Date.now(), user: { _id: 'bob' } } }
  const view = await render(
    <ProductChatRow chat={chat as never} selected={false} selecting={false} active={false} onPress={noop} onMenu={noop} />
  )
  const label = view.getByRole('button').props.accessibilityLabel as string
  expect(label.startsWith('Bob, ok, ')).toBe(true)
  expect(label).not.toContain('未读')
})
