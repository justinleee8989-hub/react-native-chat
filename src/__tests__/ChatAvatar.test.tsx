import React from 'react'
import { render } from '@testing-library/react-native'

import { ChatAvatar } from '..'
import { Avatar } from '../Avatar'

it('should render <ChatAvatar /> and compare with snapshot', async () => {
  const { toJSON } = await render(<ChatAvatar />)

  expect(toJSON()).toMatchSnapshot()
})

it('renders a noninteractive avatar without a gesture button wrapper', async () => {
  const { toJSON } = await render(<ChatAvatar user={{ _id: 'alice', name: 'Alice' }} />)
  const hasGestureButton = (node: any): boolean => !!node && typeof node === 'object' &&
    (node.type === 'RNGestureHandlerButton' || node.children?.some(hasGestureButton))

  expect(hasGestureButton(toJSON())).toBe(false)
})

it('keeps a gesture button wrapper when the avatar has an action', async () => {
  const { toJSON } = await render(<ChatAvatar user={{ _id: 'alice', name: 'Alice' }} onPress={() => {}} />)
  const hasGestureButton = (node: any): boolean => !!node && typeof node === 'object' &&
    (node.type === 'RNGestureHandlerButton' || node.children?.some(hasGestureButton))

  expect(hasGestureButton(toJSON())).toBe(true)
})

it('does not make the Chat message avatar interactive when no avatar actions were supplied', async () => {
  const { toJSON } = await render(<Avatar currentMessage={{ _id: 'message-1', user: { _id: 'alice', name: 'Alice' } }} position='left' />)
  const hasGestureButton = (node: any): boolean => !!node && typeof node === 'object' &&
    (node.type === 'RNGestureHandlerButton' || node.children?.some(hasGestureButton))

  expect(hasGestureButton(toJSON())).toBe(false)
})
