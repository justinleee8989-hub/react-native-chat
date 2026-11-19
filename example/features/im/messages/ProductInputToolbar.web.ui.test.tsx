import React from 'react'
import { Platform, StyleSheet, TextInput } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ProductInputToolbar } from './ProductInputToolbar'

let mockDesktop = false
let mockComposerScrollHeight = 40
jest.mock('../application/store', () => ({ reportError: jest.fn() }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ bg: '#fff', line: '#ddd', text2: '#666' }) }))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('react-native-keyboard-controller', () => ({ useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('react-native-reanimated', () => {
  const Native = require('react-native')
  return { __esModule: true, default: { View: Native.View }, useAnimatedStyle: (style: () => object) => style(), useSharedValue: (value: unknown) => ({ value }) }
})
jest.mock('@kesha-antonov/react-native-chat', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  const MockInput = ReactModule.forwardRef((props: object, ref: object) => {
    ReactModule.useImperativeHandle(ref, () => ({ scrollHeight: mockComposerScrollHeight }))
    return ReactModule.createElement(Native.TextInput, { testID: 'composer-input', ...props })
  })
  return {
    InputToolbar: ({ textInputProps, containerStyle, renderSend, text }: { textInputProps?: object, containerStyle?: object, renderSend?: (props: object) => React.ReactNode, text?: string }) => ReactModule.createElement(Native.View, { testID: 'sdk-toolbar', style: [{ paddingLeft: 28, paddingRight: 28 }, containerStyle] }, ReactModule.createElement(MockInput, { ...textInputProps, ref: (textInputProps as { ref?: object } | undefined)?.ref }), renderSend?.({ text, onSend: jest.fn() })),
    Send: ({ containerStyle, text, onSend }: { containerStyle?: object, text?: string, onSend?: (message: object, reset: boolean) => void }) => ReactModule.createElement(Native.Pressable, { testID: 'sdk-send', style: containerStyle, onPress: () => onSend?.({ text: text?.trim() }, true) }),
    buildAttachmentMessages: jest.fn(),
  }
})

it('sends trimmed text on web Enter and leaves Shift or IME Enter in the draft', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    const onSend = jest.fn()
    const onKeyPress = jest.fn()
    const props = { text: '  hello from web  ', onSend, textInputProps: { onKeyPress } } as any
    const view = await render(<ProductInputToolbar {...props} />)
    const input = view.getByTestId('composer-input') as unknown as React.ComponentProps<typeof TextInput>
    const preventDefault = jest.fn()

    await fireEvent(input as any, 'keyPress', { nativeEvent: { key: 'Enter' }, preventDefault })
    expect(onKeyPress).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith({ text: 'hello from web' }, true)
    expect(preventDefault).toHaveBeenCalledTimes(1)

    onSend.mockClear()
    preventDefault.mockClear()
    await fireEvent(input as any, 'keyPress', { nativeEvent: { key: 'Enter', shiftKey: true }, preventDefault })
    await fireEvent(input as any, 'keyPress', { nativeEvent: { key: 'Enter', isComposing: true }, preventDefault })
    await fireEvent(input as any, 'keyPress', { nativeEvent: { key: 'Enter', keyCode: 229 }, preventDefault })
    expect(onSend).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
    expect(onKeyPress).toHaveBeenCalledTimes(4)
  } finally {
    Platform.OS = originalPlatform
  }
})

it.each([[true, 20], [false, 8]])('sets explicit SDK toolbar side insets for desktop=%s', async (desktop, inset) => {
  mockDesktop = desktop
  try {
    const view = await render(<ProductInputToolbar {...{ text: 'draft' } as any} />)
    const style = StyleSheet.flatten(view.getByTestId('sdk-toolbar').props.style)
    expect(style.paddingLeft).toBe(inset)
    expect(style.paddingRight).toBe(inset)
  } finally {
    mockDesktop = false
  }
})

it('constrains the text send cell to the 40px composer button without changing its send action', async () => {
  mockDesktop = true
  try {
    const onSend = jest.fn()
    const view = await render(<ProductInputToolbar {...{ text: '  hello  ', onSend } as any} />)
    const send = view.getByTestId('sdk-send')
    const style = StyleSheet.flatten(send.props.style)

    expect(style).toMatchObject({ height: 40, minHeight: 40, minWidth: 40 })
    await fireEvent.press(send)
    expect(onSend).toHaveBeenCalledWith({ text: 'hello' }, true)
  } finally {
    mockDesktop = false
  }
})

it('resizes a multiline draft from content size, clamps to 40..118px, and forwards the SDK callback', async () => {
  const onContentSizeChange = jest.fn()
  const onLayout = jest.fn()
  const view = await render(<ProductInputToolbar {...{ text: 'first\nsecond', textInputProps: { onContentSizeChange, onLayout } } as any} />)
  const input = view.getByTestId('composer-input')

  expect(StyleSheet.flatten(input.props.style).height).toBe(40)
  await fireEvent(input, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 40 } } })
  expect(onLayout).toHaveBeenCalledTimes(1)
  await fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { width: 180, height: 76 } } })
  expect(StyleSheet.flatten(view.getByTestId('composer-input').props.style).height).toBe(76)
  expect(onContentSizeChange).toHaveBeenCalledTimes(1)
  await fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { width: 180, height: 160 } } })
  expect(StyleSheet.flatten(view.getByTestId('composer-input').props.style).height).toBe(118)
  await fireEvent(input, 'contentSizeChange', { nativeEvent: { contentSize: { width: 180, height: 20 } } })
  expect(StyleSheet.flatten(view.getByTestId('composer-input').props.style).height).toBe(40)
})

it('remeasures Web textarea height after a long draft shrinks to a short line', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  mockComposerScrollHeight = 84
  const forwardedRef = jest.fn()
  try {
    const view = await render(<ProductInputToolbar {...{ text: 'line one\nline two\nline three', textInputProps: { ref: forwardedRef } } as any} />)
    await waitFor(() => expect(StyleSheet.flatten(view.getByTestId('composer-input').props.style).height).toBe(84))
    expect(forwardedRef).toHaveBeenCalledWith(expect.objectContaining({ scrollHeight: 84 }))

    mockComposerScrollHeight = 42
    await view.rerender(<ProductInputToolbar {...{ text: 'short', textInputProps: { ref: forwardedRef } } as any} />)
    await waitFor(() => expect(StyleSheet.flatten(view.getByTestId('composer-input').props.style).height).toBe(42))
  } finally {
    Platform.OS = originalPlatform
    mockComposerScrollHeight = 40
  }
})
