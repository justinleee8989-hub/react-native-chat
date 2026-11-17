import React from 'react'
import { Platform, Text } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { MouseButton, useTapGesture } from 'react-native-gesture-handler'
import { PressableBubbleRow } from '../Bubble/PressableBubbleRow'

jest.mock('react-native-gesture-handler', () => ({
  MouseButton: { RIGHT: 2 },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  useExclusiveGestures: (...gestures: unknown[]) => gestures,
  useLongPressGesture: (options: unknown) => options,
  useTapGesture: jest.fn((options: unknown) => options),
}))

const row = (isContextMenuEnabled: boolean, measureBubble: () => void, onLongPressStart: (x?: number, y?: number) => void) => <PressableBubbleRow
  {...{ isContextMenuEnabled } as any}
  isGestureEnabled={false}
  onLongPressStart={onLongPressStart}
  measureBubble={measureBubble}
  context={null}
  currentMessage={{ _id: 'message', text: 'A message', createdAt: new Date(), user: { _id: 'author' } }}
  rowSurfaceStyle={{}}
  wrapperStyleList={{}}
  bubbleContainerRef={null as any}
><Text>A message</Text></PressableBubbleRow>

function findContextHandler (node: any): ((event: unknown) => void) | undefined {
  if (!node)
    return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findContextHandler(child)
      if (found)
        return found
    }
    return undefined
  }
  return node.props?.onContextMenu || findContextHandler(node.children)
}

it('does not install a browser contextmenu handler by default', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    const view = await render(row(false, jest.fn(), jest.fn()))
    expect(findContextHandler(view.toJSON())).toBeUndefined()
  } finally {
    Platform.OS = originalPlatform
  }
})

it('opens the context menu from a web right-click and consumes the browser menu', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    const measureBubble = jest.fn()
    const onLongPressStart = jest.fn()
    const view = await render(row(true, measureBubble, onLongPressStart))
    const onContextMenu = findContextHandler(view.toJSON())
    expect(onContextMenu).toEqual(expect.any(Function))

    const preventDefault = jest.fn()
    const stopPropagation = jest.fn()
    onContextMenu?.({ nativeEvent: { pageX: 73, pageY: 91 }, preventDefault, stopPropagation })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(measureBubble).toHaveBeenCalledTimes(1)
    expect(onLongPressStart).toHaveBeenCalledWith(73, 91)
  } finally {
    Platform.OS = originalPlatform
  }
})

it('enables a right-button tap only for web context-menu rows', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    await render(row(true, jest.fn(), jest.fn()))
    const tapConfigs = jest.mocked(useTapGesture).mock.calls.map(([config]) => config as any)
    const rightTap = tapConfigs.find(config => config.mouseButton === MouseButton.RIGHT)
    expect(rightTap).toEqual(expect.objectContaining({ enabled: true }))

    jest.mocked(useTapGesture).mockClear()
    await render(row(false, jest.fn(), jest.fn()))
    const disabledTapConfigs = jest.mocked(useTapGesture).mock.calls.map(([config]) => config as any)
    expect(disabledTapConfigs.find(config => config.mouseButton === MouseButton.RIGHT)).toBeUndefined()
  } finally {
    Platform.OS = originalPlatform
  }
})

it('enables a right-button tap only on web', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'ios'
  try {
    await render(row(true, jest.fn(), jest.fn()))
    const tapConfigs = jest.mocked(useTapGesture).mock.calls.map(([config]) => config as any)
    expect(tapConfigs.find(config => config.mouseButton === MouseButton.RIGHT)).toBeUndefined()
  } finally {
    Platform.OS = originalPlatform
  }
})

it('opens the context menu on a non-canceled right-button tap', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    const measureBubble = jest.fn()
    const onLongPressStart = jest.fn()
    await render(row(true, measureBubble, onLongPressStart))
    const rightTap = jest.mocked(useTapGesture).mock.calls.map(([config]) => config as any).find(config => config.mouseButton === MouseButton.RIGHT)
    expect(rightTap).toBeDefined()
    rightTap.onDeactivate({ canceled: false, absoluteX: 73, absoluteY: 91 })
    expect(measureBubble).toHaveBeenCalledTimes(1)
    expect(onLongPressStart).toHaveBeenCalledWith(73, 91)
  } finally {
    Platform.OS = originalPlatform
  }
})

it('ignores a canceled right-button tap', async () => {
  const originalPlatform = Platform.OS
  Platform.OS = 'web'
  try {
    const measureBubble = jest.fn()
    const onLongPressStart = jest.fn()
    await render(row(true, measureBubble, onLongPressStart))
    const rightTap = jest.mocked(useTapGesture).mock.calls.map(([config]) => config as any).find(config => config.mouseButton === MouseButton.RIGHT)
    expect(rightTap).toBeDefined()
    rightTap.onDeactivate({ canceled: true, absoluteX: 73, absoluteY: 91 })
    expect(measureBubble).not.toHaveBeenCalled()
    expect(onLongPressStart).not.toHaveBeenCalled()
  } finally {
    Platform.OS = originalPlatform
  }
})
