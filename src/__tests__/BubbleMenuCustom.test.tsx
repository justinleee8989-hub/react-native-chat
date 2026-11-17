import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { BubbleMenu } from '../Bubble/BubbleMenu'
import { DEFAULT_TEST_MESSAGE } from './data'

it('delegates the context menu with actions and anchor without mounting the lifted preview', async () => {
  const close = jest.fn(), lift = jest.fn()
  const renderer = jest.fn(props => <Text>{props.items[0].label}:{props.pageX}</Text>)
  const view = await render(<BubbleMenu bubble={{ currentMessage: DEFAULT_TEST_MESSAGE, position: 'left', renderContextMenu: renderer }} layout={{ visualPosition: 'left' } as any} menu={{ isPickerVisible: true, isLifted: false, pickerAnchor: { pageX: 42, pageY: 30, bubbleWidth: 100, bubbleHeight: 40 }, touchPoint: {}, close, measureBubble: jest.fn(), setIsLifted: lift } as any} menuItems={[{ key: 'reply', label: 'Reply', onPress: jest.fn() }]} wrapperStyleList={{}} reactionsDisplay={null} />)
  expect(view.getByText('Reply:42')).toBeTruthy()
  expect(renderer.mock.calls[0][0].onDismiss).toBe(close)
  expect(lift).not.toHaveBeenCalled()
})
