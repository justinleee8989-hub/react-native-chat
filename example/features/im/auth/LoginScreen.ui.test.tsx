import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { ProductError, ServerError } from '../shared/product-error'
import LoginScreen from './LoginScreen'

let mockState: Record<string, unknown>
let mockParams: Record<string, string>
let mockTransitionEnd: ((event: { data?: { closing?: boolean } }) => void) | undefined
const mockFocus = jest.fn()
let mockBlur: (() => void) | undefined
const mockLogin = jest.fn()
jest.mock('../application/store', () => ({ login: (...args: unknown[]) => mockLogin(...args), useOpenIM: () => mockState }))
jest.mock('expo-router', () => ({
  // Focused on mount, like a page that has just opened; `mockBlur` covers it with another.
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(() => {
    const blur = effect()
    mockBlur = blur || undefined
    return blur
  }, [effect]),
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
  useNavigation: () => ({
    addListener: () => () => {},
    getParent: () => ({ addListener: (_event: string, listener: (event: { data?: { closing?: boolean } }) => void) => {
      mockTransitionEnd = listener
      return () => {}
    } }),
  }),
}))
jest.mock('./AuthForm', () => {
  const { Pressable, Text, TextInput, View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    // The sprite's state, where a test can read it.
    AuthPage: ({ children, mood, covered }: React.PropsWithChildren<{ mood?: string, covered?: boolean }>) => (
      <View testID='page' accessibilityHint={mood} accessibilityValue={{ text: covered ? 'covered' : 'shown' }}>{children}</View>
    ),
    AuthField: (props: {
      label: string
      value: string
      autoFocus?: boolean
      invalid?: boolean
      ref?: { current: unknown }
      onChangeText?: (value: string) => void
      onFocus?: () => void
      onBlur?: () => void
      onRevealChange?: (visible: boolean) => void
    }) => {
      if (props.ref)
        props.ref.current = { focus: mockFocus }
      return (
        <View>
          <TextInput
            accessibilityLabel={props.label}
            accessibilityHint={props.invalid ? 'invalid' : undefined}
            value={props.value}
            autoFocus={props.autoFocus}
            onChangeText={props.onChangeText}
            onFocus={props.onFocus}
            onBlur={props.onBlur}
          />
          {props.onRevealChange && <Pressable accessibilityRole='button' accessibilityLabel='reveal' onPress={() => props.onRevealChange?.(true)} />}
        </View>
      )
    },
    AuthButton: ({ title, onPress }: { title: string, onPress: () => void }) => <Pressable accessibilityRole='button' onPress={onPress}><Text>{title}</Text></Pressable>,
    AuthLink: ({ title }: { title: string }) => <Text>{title}</Text>,
    AuthNotice: ({ children }: React.PropsWithChildren) => <Text>{children}</Text>,
    AuthPrompt: ({ text, children }: React.PropsWithChildren<{ text: string }>) => <View><Text>{text}</Text>{children}</View>,
  }
})

const servers = { chat: 'http://chat', api: 'http://api', ws: 'ws://ws' }
const last = { account: 'alice@example.com' }

beforeEach(() => {
  mockParams = {}
  mockTransitionEnd = undefined
  mockFocus.mockClear()
  mockLogin.mockClear()
  mockState = { busy: false, error: '', config: servers }
})

it('fills in the last account after an expired login, asking only the password', async () => {
  mockState = { ...mockState, lastAccount: last, error: new ProductError('session.expired') }
  const view = await render(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('alice@example.com')
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
})

it('keeps the account a link opened it with (注册, 忘记密码)', async () => {
  mockParams = { email: 'bob@example.com' }
  mockState = { ...mockState, lastAccount: last }
  const view = await render(<LoginScreen />)
  expect(view.getByLabelText('邮箱账号').props.value).toBe('bob@example.com')
})

it('has no server settings: the app signs in to the servers it was built for', async () => {
  const view = await render(<LoginScreen />)
  for (const label of ['服务连接', '账户服务地址', '消息服务地址', '实时连接地址'])
    expect(view.queryByText(label) ?? view.queryByLabelText(label)).toBeNull()
})

it('focuses the password again when the sign-out transition ends, so Android shows the keyboard', async () => {
  mockState = { ...mockState, lastAccount: last }
  await render(<LoginScreen />)
  expect(mockTransitionEnd).toBeDefined()
  mockTransitionEnd?.({ data: { closing: false } })
  expect(mockFocus).toHaveBeenCalledTimes(1)
  // Signed in: the page's own closing transition must not bring the keyboard up over the home page.
  mockTransitionEnd?.({ data: { closing: true } })
  expect(mockFocus).toHaveBeenCalledTimes(1)
})

const moodOf = (view: Awaited<ReturnType<typeof render>>) => view.getByTestId('page').props.accessibilityHint

it('has the sprite lean over the email, turn from the password and peek once it is shown', async () => {
  const view = await render(<LoginScreen />)
  expect(moodOf(view)).toBe('idle')
  await fireEvent(view.getByLabelText('邮箱账号'), 'focus')
  expect(moodOf(view)).toBe('email')
  await fireEvent(view.getByLabelText('密码'), 'focus')
  expect(moodOf(view)).toBe('password')
  await fireEvent.changeText(view.getByLabelText('密码'), 'secret')
  // On the web, pressing 显示 takes the focus off the field: the shown password is still peeked at.
  await fireEvent(view.getByLabelText('密码'), 'blur')
  await fireEvent.press(view.getByRole('button', { name: 'reveal' }))
  expect(moodOf(view)).toBe('peek')
})

it('slumps the sprite and edges the fields in red after a refused sign-in, until the user types again', async () => {
  mockState = { ...mockState, error: new ProductError('session.expired') }
  const view = await render(<LoginScreen />)
  // An error the page opened with (an expired login) is not a refusal.
  expect(moodOf(view)).toBe('idle')
  await fireEvent.changeText(view.getByLabelText('邮箱账号'), 'alice@example.com')
  await fireEvent.changeText(view.getByLabelText('密码'), 'wrong')
  await fireEvent.press(view.getByRole('button', { name: '登录' }))
  expect(mockLogin).toHaveBeenCalledWith('alice@example.com', 'wrong')
  mockState = { ...mockState, busy: true, error: '' }
  await view.rerender(<LoginScreen />)
  expect(moodOf(view)).toBe('busy')
  mockState = { ...mockState, busy: false, error: new ProductError('serverError.20001') }
  await view.rerender(<LoginScreen />)
  expect(moodOf(view)).toBe('error')
  expect(view.getByLabelText('密码').props.accessibilityHint).toBe('invalid')
  expect(view.getByText('账号或密码错误')).toBeTruthy()
  await fireEvent.changeText(view.getByLabelText('密码'), 'right')
  expect(moodOf(view)).toBe('idle')
  expect(view.getByLabelText('密码').props.accessibilityHint).toBeUndefined()
  // The refusal's notice goes with the red edges.
  expect(view.queryByText('账号或密码错误')).toBeNull()
  // Refused again: a new error, said again.
  await fireEvent.press(view.getByRole('button', { name: '登录' }))
  mockState = { ...mockState, error: new ProductError('serverError.20001') }
  await view.rerender(<LoginScreen />)
  expect(view.getByText('账号或密码错误')).toBeTruthy()
})

it('edges in red only the fields the server said are wrong, never for a connection problem', async () => {
  const view = await render(<LoginScreen />)
  const hints = () => [view.getByLabelText('邮箱账号').props.accessibilityHint, view.getByLabelText('密码').props.accessibilityHint]
  const refuse = async (error: unknown) => {
    await fireEvent.changeText(view.getByLabelText('邮箱账号'), 'alice@example.com')
    await fireEvent.changeText(view.getByLabelText('密码'), 'secret')
    await fireEvent.press(view.getByRole('button', { name: '登录' }))
    mockState = { ...mockState, busy: false, error }
    await view.rerender(<LoginScreen />)
  }
  await refuse(new ProductError('auth.network'))
  expect(view.getByText(/无法连接服务器/)).toBeTruthy()
  expect(moodOf(view)).toBe('error')
  expect(hints()).toEqual([undefined, undefined])
  await refuse(new ServerError({ errCode: 20002 }))
  expect(view.getByText('账号不存在')).toBeTruthy()
  expect(hints()).toEqual(['invalid', undefined])
  await refuse(new ServerError({ errCode: 20001 }))
  expect(hints()).toEqual(['invalid', 'invalid'])
})

it('holds the sprite still while 注册 or 忘记密码 is open over the page', async () => {
  const view = await render(<LoginScreen />)
  expect(view.getByTestId('page').props.accessibilityValue).toEqual({ text: 'shown' })
  await act(() => mockBlur?.())
  expect(view.getByTestId('page').props.accessibilityValue).toEqual({ text: 'covered' })
})

it('keeps why the user was signed out while they type', async () => {
  mockState = { ...mockState, lastAccount: last, error: new ProductError('session.expired') }
  const view = await render(<LoginScreen />)
  await fireEvent.changeText(view.getByLabelText('密码'), 'secret')
  await fireEvent.changeText(view.getByLabelText('邮箱账号'), 'bob@example.com')
  expect(view.getByText('登录已失效，请重新登录')).toBeTruthy()
})
