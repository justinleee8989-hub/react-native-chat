import React from 'react'
import { Platform, StyleSheet, Text } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { ProductButton, ProductHeader, ProductListRow, ProductRow, ProductSheet, ProductSwitch } from './primitives'
import { productOverlayGeometry } from './ProductModal'
import { ProductIconButton } from './ProductPage'

let mockDesktop = false
jest.mock('./preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('./theme', () => ({ useProductTheme: () => require('./tokens').productPalette.light }))
jest.mock('./ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false, replace: jest.fn(), back: jest.fn() }) }))
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => ({ canGoBackInSection: false }) }))
jest.mock('@kesha-antonov/react-native-chat', () => ({ ChatListAvatar: () => null }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 20 }) }))

it('toggles once with accessible checked and disabled states', async () => {
  const change = jest.fn()
  const screen = await render(<ProductSwitch accessibilityLabel='通知' value onValueChange={change} />)
  await fireEvent.press(screen.getByRole('switch', { name: '通知', checked: true }))
  expect(change).toHaveBeenCalledTimes(1)
  expect(change).toHaveBeenCalledWith(false)
  await screen.rerender(<ProductSwitch accessibilityLabel='通知' value disabled onValueChange={change} />)
  await fireEvent.press(screen.getByRole('switch'))
  expect(change).toHaveBeenCalledTimes(1)
})

it('keeps cancel separate and blocks actions and dismissal while busy', async () => {
  const close = jest.fn()
  const action = jest.fn()
  const screen = await render(<ProductSheet title='外观' onClose={close} items={[{ title: '浅色', onPress: action }]} />)
  await fireEvent.press(screen.getByRole('button', { name: '取消' }))
  expect(close).toHaveBeenCalledTimes(1)
  await screen.rerender(<ProductSheet busy title='外观' onClose={close} items={[{ title: '浅色', onPress: action }]} />)
  await fireEvent.press(screen.getByRole('button', { name: '取消' }))
  await fireEvent.press(screen.getByRole('button', { name: '浅色' }))
  expect(close).toHaveBeenCalledTimes(1)
  expect(action).not.toHaveBeenCalled()
})

it('exposes long sheet options through scroll content and keeps them actionable', async () => {
  const select = jest.fn()
  const options = Array.from({ length: 24 }, (_, index) => ({ title: index === 23 ? `最后一项 ${'很长的权限说明 '.repeat(8)}` : `操作 ${index + 1}`, onPress: () => select(index) }))
  const last = options[23]
  const view = await render(<ProductSheet onClose={jest.fn()} items={options} />)
  const option = view.getByRole('button', { name: last.title })
  await fireEvent.press(option)
  expect(select).toHaveBeenCalledWith(23)
})

it('renders desktop action labels at regular weight with a half-pixel row separator', async () => {
  const previous = mockDesktop
  const previousPlatform = Platform.OS
  mockDesktop = true
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  try {
    const view = await render(<ProductSheet onClose={jest.fn()} items={[{ title: '更多操作', onPress: jest.fn() }, { title: '查看资料', onPress: jest.fn() }]} />)
    const label = view.getByText('查看资料')
    expect(StyleSheet.flatten(label.props.style)?.fontWeight).toBe('400')
    const button = view.getByRole('button', { name: '查看资料' })
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ boxShadow: `inset 0 0.5px 0 ${require('./tokens').productPalette.light.line}` })
  } finally {
    mockDesktop = previous
    Object.defineProperty(Platform, 'OS', { configurable: true, value: previousPlatform })
  }
})

it.each([
  ['settings row', <ProductRow key='row' title='设置项' onPress={jest.fn()} />, '设置项'],
  ['list row', <ProductListRow key='list' title='会话标题' onPress={jest.fn()} />, '会话标题'],
  ['sheet action', <ProductSheet key='sheet' onClose={jest.fn()} items={[{ title: '更多操作', onPress: jest.fn() }]} />, '更多操作'],
  ['header back button', <ProductHeader key='header' title='详细信息' onBack={jest.fn()} />, '返回'],
  ['header icon action', <ProductIconButton key='icon' name='plus' label='添加好友' onPress={jest.fn()} />, '添加好友'],
])('uses the hover surface for a %s on pointer entry', async (_kind, component, buttonName) => {
  const previous = mockDesktop
  mockDesktop = true
  try {
    const view = await render(component)
    const button = view.getByRole('button', { name: buttonName })
    await fireEvent(button, 'hoverIn', { nativeEvent: { pointerType: 'mouse' } })
    const hovered = view.getByRole('button', { name: buttonName })
    expect(StyleSheet.flatten(hovered.props.style)?.backgroundColor).toBe(require('./tokens').productPalette.light.surface2)
  } finally {
    mockDesktop = previous
  }
})

it('keeps pointer hover styling off in the phone layout', async () => {
  mockDesktop = false
  const view = await render(<ProductRow title='设置项' onPress={jest.fn()} />)
  const button = view.getByRole('button', { name: '设置项' })
  await fireEvent(button, 'hoverIn', { nativeEvent: { pointerType: 'mouse' } })
  expect(StyleSheet.flatten(view.getByRole('button', { name: '设置项' }).props.style)?.backgroundColor).toBe(require('./tokens').productPalette.light.surface)
})

it('keeps extremely long list titles and subtitles single-line while retaining row actions', async () => {
  const press = jest.fn()
  const title = '超长会话标题'.repeat(80)
  const subtitle = '超长消息摘要'.repeat(80)
  const view = await render(<ProductListRow title={title} subtitle={subtitle} trailing={<Text>3</Text>} onPress={press} />)
  expect(view.getByText(title).props.numberOfLines).toBe(1)
  expect(view.getByText(subtitle).props.numberOfLines).toBe(1)
  await fireEvent.press(view.getByRole('button'))
  expect(press).toHaveBeenCalledTimes(1)
})

it('keeps an interactive trailing action separate from the main row action', async () => {
  const mainAction = jest.fn()
  const trailingAction = jest.fn()
  const view = await render(<ProductRow title='Alice' onPress={mainAction} trailingInteractive trailing={<ProductButton compact title='移出' onPress={trailingAction} />} />)
  let ancestor = view.getByRole('button', { name: '移出' }).parent
  while (ancestor) {
    expect(ancestor.props.accessibilityRole).not.toBe('button')
    ancestor = ancestor.parent
  }
  await fireEvent.press(view.getByRole('button', { name: '移出' }))
  expect(trailingAction).toHaveBeenCalledTimes(1)
  expect(mainAction).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('Alice'))
  expect(mainAction).toHaveBeenCalledTimes(1)
  expect(trailingAction).toHaveBeenCalledTimes(1)
})

it('prevents a busy primary action and keeps header controls accessible', async () => {
  const press = jest.fn()
  const screen = await render(<><ProductButton title='保存' busy onPress={press} /><ProductHeader title='资料' onBack={press} right={<Text>较长的操作</Text>} /></>)
  await fireEvent.press(screen.getByRole('button', { name: '保存' }))
  expect(press).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: '返回' }))
  expect(press).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('header', { name: '资料' })).toBeTruthy()
})

it('constrains overlays to the desktop or phone preview frame and preserves native full screen', () => {
  expect(productOverlayGeometry(1280, 1000, true, true)).toEqual({ width: 390, height: 844, topInset: 36, radius: 18 })
  expect(productOverlayGeometry(1600, 1000, false, true)).toEqual({ width: 1360, height: 880, topInset: 0, radius: 18 })
  expect(productOverlayGeometry(1280, 1000, true, false)).toEqual({ width: 1280, height: 1000, topInset: 0, radius: 0 })
})

it('keeps a large no-action desktop header at 58px instead of the 66px minimum', async () => {
  const previous = mockDesktop
  mockDesktop = true
  try {
    const screen = await render(<ProductHeader title='我的' large />)
    const style = StyleSheet.flatten(screen.toJSON()?.props.style)
    expect(style.minHeight).toBe(58)
    expect(style.alignItems).toBe('center')
  } finally {
    mockDesktop = previous
  }
})

it.each([false, true])('draws a section title the same on a phone and on PC (desktop=%s)', async desktop => {
  const previous = mockDesktop
  mockDesktop = desktop
  try {
    const screen = await render(<ProductHeader title='通讯录' large />)
    const style = StyleSheet.flatten(screen.getByRole('header', { name: '通讯录' }).props.style)
    expect(style).toEqual(expect.objectContaining({ fontSize: 18, lineHeight: 24, fontWeight: '500' }))
    expect(style.textAlign).toBe(desktop ? 'left' : 'center')
  } finally {
    mockDesktop = previous
  }
})

it('says a failed action centred under the sheet actions, as an alert', async () => {
  const view = await render(<ProductSheet title='Bob' onClose={jest.fn()} items={[{ title: '设置备注', onPress: jest.fn() }]} error='操作失败' />)
  const error = view.getByRole('alert')
  expect(error.props.children).toBe('操作失败')
  expect(StyleSheet.flatten(error.props.style)).toMatchObject({ textAlign: 'center', paddingHorizontal: 20 })
})

it('gives a centred title the whole bar but the back button when nothing is on the right', async () => {
  const room = (view: Awaited<ReturnType<typeof render>>) =>
    StyleSheet.flatten(view.getByRole('header').parent?.props.style)
  const plain = await render(<ProductHeader title='Account security' onBack={jest.fn()} />)
  expect(room(plain)).toMatchObject({ left: 56, right: 56 })
  const withAction = await render(<ProductHeader title='Account security' onBack={jest.fn()} right={<Text>Save</Text>} />)
  expect(room(withAction)).toMatchObject({ left: 92, right: 92 })
})
