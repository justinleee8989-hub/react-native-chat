import React from 'react'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { InputToolbar } from '..'
import { render } from './renderWithGestureRoot'

// Gesture-handler BaseButton needs a pressable test boundary, as in attachments.test.
jest.mock('../components/TouchableOpacity', () => {
  const { Pressable } = jest.requireActual('react-native')
  const { createElement } = jest.requireActual('react')
  return { TouchableOpacity: (props: Record<string, unknown>) => createElement(Pressable, props) }
})

it('keeps leading attachment and trailing emoji actions usable while a draft is present', async () => {
  const attachment = jest.fn()
  const emoji = jest.fn()
  const view = await render(<InputToolbar actionsPosition='leading' text='draft' onPressActionButton={attachment} onPressEmoji={emoji} renderComposer={() => <Text>draft field</Text>} audioRecording={false} videoRecording={false} />)
  await fireEvent.press(view.getByLabelText('Attach'))
  await fireEvent.press(view.getByLabelText('Emoji'))
  expect(attachment).toHaveBeenCalledTimes(1)
  expect(emoji).toHaveBeenCalledTimes(1)
  expect(view.getByText('draft field')).toBeTruthy()
})
