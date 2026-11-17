import React from 'react'
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { ProductInputToolbar } from './ProductInputToolbar'

jest.mock('../application/store', () => ({ reportError: jest.fn() }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({}) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('react-native-keyboard-controller', () => ({ useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('react-native-reanimated', () => {
  const Native = require('react-native')
  return { __esModule: true, default: { View: Native.View }, useAnimatedStyle: (style: () => object) => style(), useSharedValue: (value: unknown) => ({ value }) }
})
jest.mock('@kesha-antonov/react-native-chat', () => ({ InputToolbar: ({ renderActions, onPressEmoji }: { renderActions: () => React.ReactNode, onPressEmoji: () => void }) => <MockView>{renderActions()}<MockPressable onPress={onPressEmoji}><MockText>表情</MockText></MockPressable></MockView>, buildAttachmentMessages: jest.fn() }))
it('opens inline attachments and delegates picks to the real send callback, then inserts emoji into the draft', async () => {
  const onPick = jest.fn<(...args: unknown[]) => Promise<null>>(async () => null)
  const onChangeText = jest.fn()
  const picks = [{ type: 'file' as const, uri: 'file:///document', name: 'document' }]
  const view = await render(<ProductInputToolbar text='draft' textInputProps={{ onChangeText }} attachments={{ onPick, tabs: ['file'], renderAttachmentMenu: props => props.visible && <MockPressable onPress={() => props.onSend(picks, 'caption')}><MockText>文件</MockText></MockPressable> }} />)
  expect(view.queryByText('文件')).toBeNull()
  await fireEvent.press(view.getByLabelText('更多附件'))
  await fireEvent.press(view.getByText('文件'))
  expect(onPick).toHaveBeenCalledWith(picks, { caption: 'caption' })
  await fireEvent.press(view.getByText('表情'))
  expect(view.queryByText('文件')).toBeNull()
  await fireEvent.press(view.getByLabelText('😀'))
  expect(onChangeText).toHaveBeenCalledWith('draft😀')
})

it('keeps the composer mounted while permissions are pending', async () => {
  const view = await render(<ProductInputToolbar accessPending text='' />)
  const initial = view.getByTestId('product-composer')
  expect(initial.props.pointerEvents).toBe('none')
  expect(view.getByLabelText('更多附件')).toBeTruthy()
  await view.rerender(<ProductInputToolbar accessPending={false} text='' />)
  expect(view.getByTestId('product-composer').props.pointerEvents).toBe('auto')
})
