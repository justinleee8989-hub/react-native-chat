import React from 'react'
import { Text } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { ProductPage } from './ProductPage'

let mockDesktop = true
let mockCanGoBack = false
let mockRouterCanGoBack = true
const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => ({ canGoBackInSection: mockCanGoBack }) }))
jest.mock('./preferences', () => ({ useProductLayout: () => ({ desktop: mockDesktop }) }))
jest.mock('./theme', () => ({ useProductTheme: () => ({}) }))
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null }))
jest.mock('./primitives', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { ProductHeader: ({ title, onBack }: { title: string, onBack?: () => void }) => <View><Text>{title}</Text>{onBack && <Pressable accessibilityLabel='返回' onPress={onBack} />}</View> }
})
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => mockRouterCanGoBack, back: mockBack, replace: mockReplace }) }))

it.each([
  [true, false, false],
  [true, true, true],
  [false, false, true],
])('shows the default back control for desktop=%s deeper=%s: %s', async (desktop, deeper, visible) => {
  mockDesktop = desktop
  mockCanGoBack = deeper
  const view = await render(<ProductPage title='资料' busy={false} error='' />)
  const back = view.queryByLabelText('返回')
  expect(!!back).toBe(visible)
  if (back) {
    await fireEvent.press(back)
    expect(mockBack).toHaveBeenCalledTimes(1)
  }
})

it('keeps a long service error accessible while the page is busy', async () => {
  const error = '服务暂时不可用，请检查网络后重试。'.repeat(120)
  const view = await render(<ProductPage title='成员管理' busy error={error}><Text>成员列表</Text></ProductPage>)
  expect(view.getByLabelText('正在处理')).toBeTruthy()
  expect(view.getByRole('alert').props.children).toBe(error)
  expect(view.getByText('成员列表')).toBeTruthy()
})

it('keeps an explicit back control on desktop root pages and falls back to its route', async () => {
  mockDesktop = true
  mockCanGoBack = false
  mockRouterCanGoBack = false
  const view = await render(<ProductPage title='发起聊天' busy={false} error='' alwaysShowBack backHref='/(tabs)/chats' />)
  await fireEvent.press(view.getByLabelText('返回'))
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/chats')
})


it('shows a content skeleton before first data and keeps the page title', async () => {
  const view = await render(<ProductPage title='通讯录' busy={false} error='' initialLoading skeleton='list'><Text>还没有好友</Text></ProductPage>)
  expect(view.getByText('通讯录')).toBeTruthy()
  expect(view.getByLabelText('正在加载内容')).toBeTruthy()
  expect(view.queryByText('还没有好友')).toBeNull()
})

it('shows a retry instead of skeleton or false empty content after initial failure', async () => {
  const retry = jest.fn()
  const view = await render(<ProductPage title='群聊' busy={false} error='连接失败' initialLoading onRetry={retry}><Text>还没有群聊</Text></ProductPage>)
  expect(view.queryByLabelText('正在加载内容')).toBeNull()
  expect(view.queryByText('还没有群聊')).toBeNull()
  await fireEvent.press(view.getByRole('button', { name: '重新加载' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it('preserves loaded content during background refresh', async () => {
  const view = await render(<ProductPage title='我的' busy error='' initialLoading={false}><Text>已有资料</Text></ProductPage>)
  expect(view.getByText('已有资料')).toBeTruthy()
  expect(view.queryByLabelText('正在加载内容')).toBeNull()
})
