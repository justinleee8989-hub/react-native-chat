import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import LoginScreen from './LoginScreen'

let mockState: Record<string, unknown>
let mockParams: Record<string, string>
jest.mock('../application/store', () => ({ login: jest.fn(), useOpenIM: () => mockState }))
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ push: jest.fn() }) }))
jest.mock('./AuthForm', () => {
  const { Text, TextInput, View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    AuthPage: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
    AuthField: (props: { label: string, value: string, autoFocus?: boolean }) => <TextInput accessibilityLabel={props.label} value={props.value} autoFocus={props.autoFocus} />,
    AuthButton: ({ title }: { title: string }) => <Text>{title}</Text>,
    AuthLink: ({ title }: { title: string }) => <Text>{title}</Text>,
    AuthLinks: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
    AuthNotice: ({ children }: React.PropsWithChildren) => <Text>{children}</Text>,
    AdvancedSettings: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
  }
})

const servers = { chat: 'http://chat', api: 'http://api', ws: 'ws://ws' }
const last = { account: 'alice@example.com', config: { chat: 'http://saved-chat', api: 'http://saved-api', ws: 'ws://saved-ws' } }

beforeEach(() => {
  mockParams = {}
  mockState = { busy: false, error: '', config: servers }
})

it('fills in the last account and its servers after an expired login, asking only the password', async () => {
  mockState = { ...mockState, lastAccount: last, error: '登录已失效，请重新登录' }
  const view = await render(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('alice@example.com')
  expect(view.getByLabelText('账户服务地址').props.value).toBe('http://saved-chat')
  expect(view.getByLabelText('密码').props.autoFocus).toBe(true)
  expect(view.getByText('登录已失效，请重新登录')).toBeTruthy()
  expect(view.queryByText('重试恢复上次登录')).toBeNull()
})

it('fills in the last account when it is read after the page mounted', async () => {
  const view = await render(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('')
  mockState = { ...mockState, lastAccount: last }
  await view.rerender(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('alice@example.com')
  expect(view.getByLabelText('消息服务地址').props.value).toBe('http://saved-api')
})

it('keeps the account a link opened it with (注册, 忘记密码)', async () => {
  mockParams = { email: 'bob@example.com' }
  mockState = { ...mockState, lastAccount: last }
  const view = await render(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('bob@example.com')
  expect(view.getByLabelText('账户服务地址').props.value).toBe('http://chat')
})
