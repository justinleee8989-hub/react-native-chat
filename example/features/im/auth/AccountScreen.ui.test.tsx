import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createAccountService } from './account-api'
import AccountScreen from './AccountScreen'

const mockReplace = jest.fn()
const mockLogin = jest.fn<(...args: unknown[]) => Promise<void>>()
let mockSession: object | undefined
const sendCode = jest.fn<ReturnType<typeof createAccountService>['sendCode']>()
const submit = jest.fn<ReturnType<typeof createAccountService>['submit']>()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useLocalSearchParams: () => ({}) }))
jest.mock('../application/store', () => ({ login: (...args: unknown[]) => mockLogin(...args), useOpenIM: () => ({ session: mockSession, config: { chat: 'http://test', api: 'http://test', ws: 'ws://test' } }) }))
jest.mock('./AccountScreen', () => {
  process.env.EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED = 'true'
  return jest.requireActual('./AccountScreen')
})
jest.mock('./account-api', () => ({ createAccountService: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSession = undefined
  mockLogin.mockResolvedValue(undefined)
  jest.mocked(createAccountService).mockReturnValue({ sendCode, submit })
  sendCode.mockResolvedValue(undefined)
  submit.mockResolvedValue(undefined)
})

it('registration validates fields and retries only login after account creation', async () => {
  await render(<AccountScreen mode='register' />)
  await fireEvent.changeText(screen.getByLabelText('邮箱'), 'person@example.com')
  await fireEvent.changeText(screen.getByLabelText('邮箱验证码'), '123456')
  await fireEvent.changeText(screen.getByLabelText('密码'), 'secret')
  await fireEvent.changeText(screen.getByLabelText('确认密码'), 'different')
  await fireEvent.press(screen.getByRole('button', { name: '创建账户' }))
  expect(submit).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText('确认密码'), 'secret')
  await fireEvent.press(screen.getByRole('button', { name: '创建账户' }))
  expect(submit).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText('昵称'), '测试用户')
  await fireEvent.press(screen.getByRole('button', { name: '创建账户' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '重试登录' })).toBeTruthy())
  expect(mockLogin).toHaveBeenCalledWith('person@example.com', 'secret')
  expect(mockReplace).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: '重试登录' }))
  expect(submit).toHaveBeenCalledTimes(1)
  expect(mockLogin).toHaveBeenCalledTimes(2)
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mode: 'register', email: 'person@example.com', password: 'secret' }))
  await fireEvent.press(screen.getByRole('button', { name: '已有账户？返回登录' }))
  expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/auth/login', params: expect.objectContaining({ email: 'person@example.com' }) }))
})

it('a successful code request prevents immediate resends', async () => {
  await render(<AccountScreen mode='reset' />)
  await fireEvent.changeText(screen.getByLabelText('邮箱'), 'person@example.com')
  await fireEvent.press(screen.getByRole('button', { name: '发送邮箱验证码' }))
  await waitFor(() => expect(screen.getByText('60 秒后重新发送')).toBeTruthy())
  await fireEvent.press(screen.getByRole('button', { name: '60 秒后重新发送' }))
  expect(sendCode).toHaveBeenCalledTimes(1)
})

it('password reset failures remain visible without claiming success', async () => {
  submit.mockRejectedValue(new Error('验证码错误'))
  await render(<AccountScreen mode='reset' />)
  await fireEvent.changeText(screen.getByLabelText('邮箱'), 'person@example.com')
  await fireEvent.changeText(screen.getByLabelText('邮箱验证码'), 'wrong')
  await fireEvent.changeText(screen.getByLabelText('新密码'), 'secret')
  await fireEvent.changeText(screen.getByLabelText('确认密码'), 'secret')
  await fireEvent.press(screen.getByRole('button', { name: '重置密码' }))
  await waitFor(() => expect(screen.getByText('验证码错误')).toBeTruthy())
  expect(screen.queryByText('密码已重置')).toBeNull()
})

it('enters chats only when the real session becomes available', async () => {
  const view = await render(<AccountScreen mode='register' />)
  expect(mockReplace).not.toHaveBeenCalled()
  mockSession = { userID: 'created', imToken: 'server-token' }
  await view.rerender(<AccountScreen mode='register' />)
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/chats'))
})
it('successful reset returns to login and does not authenticate', async () => {
  await render(<AccountScreen mode='reset' />)
  await fireEvent.changeText(screen.getByLabelText('邮箱'), 'person@example.com')
  await fireEvent.changeText(screen.getByLabelText('邮箱验证码'), '123456')
  await fireEvent.changeText(screen.getByLabelText('新密码'), 'secret')
  await fireEvent.changeText(screen.getByLabelText('确认密码'), 'secret')
  await fireEvent(screen.getByLabelText('确认密码'), 'submitEditing')
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/auth/login' })))
  expect(mockLogin).not.toHaveBeenCalled()
})
