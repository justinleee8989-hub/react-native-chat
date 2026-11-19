import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ProductBubble, ProductMessage } from './ProductMessage'

jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: false }) }))
jest.mock('../ui/ProductChatTheme', () => ({ useChatPill: () => undefined, useChatThemeLook: () => ({ preset: { radius: 20, corner: 6 }, look: { text: '#fff' } }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', text2: '#555', text3: '#777', accent: '#06f', danger: '#f00' }) }))
jest.mock('../ui/primitives', () => ({ ProductAvatar: () => null }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('./presentation', () => ({ messageTimestamp: () => '今天' }))
jest.mock('./ProductAudio', () => ({ ProductAudio: () => null }))
jest.mock('./ProductContextMenu', () => ({ ProductContextMenu: () => null }))
jest.mock('./ProductFile', () => ({ ProductFile: () => null }))
jest.mock('./ProductMessageParts', () => ({ ProductMessageImage: () => null, ProductMessageText: () => null, ProductReactions: () => null }))
jest.mock('./ProductQuote', () => ({ ProductQuote: () => null }))
jest.mock('@kesha-antonov/react-native-chat', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  const { MessageWidth } = require('./ProductMessage/context')
  return {
    Bubble: () => ReactModule.createElement(Native.View),
    Message: ({ currentMessage, renderSystemMessage }: { currentMessage: { text: string, system?: boolean }, renderSystemMessage?: (props: { currentMessage: { text: string } }) => React.ReactNode }) => {
      const width = ReactModule.useContext(MessageWidth)
      return currentMessage.system
        ? renderSystemMessage?.({ currentMessage })
        : ReactModule.createElement(Native.Text, { testID: 'message-width' }, `${currentMessage.text}:${width}`)
    },
  }
})

const message = (system = false) => ({ _id: system ? 'system' : 'message', text: system ? '加入了群聊' : '普通消息', system, createdAt: new Date(), user: { _id: 'author', name: '小林' } })

it('renders a bubble with empty previous and next neighbor objects', async () => {
  await render(<ProductBubble {...{ currentMessage: message(), previousMessage: {}, nextMessage: {}, position: 'left' } as any} />)
})

it.each([true, false])('renders a first %s message when both neighbor objects are empty', async system => {
  const currentMessage = message(system)
  const view = await render(<ProductMessage {...{ currentMessage, previousMessage: {}, nextMessage: {}, position: 'left', group: false, onReaders: jest.fn() } as any} />)
  expect(view.getByText(system ? currentMessage.text : `${currentMessage.text}:undefined`)).toBeTruthy()
})

it('uses the shared width on the first render without a per-row layout subscription', async () => {
  const view = await render(<ProductMessage {...{ currentMessage: message(), previousMessage: {}, nextMessage: {}, position: 'right', group: false, containerWidth: 390, onReaders: jest.fn() } as any} />)
  expect(view.getByTestId('message-width').props.children).toBe('普通消息:366')
  expect((view.toJSON() as any).props.onLayout).toBeUndefined()
})
