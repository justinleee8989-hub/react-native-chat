import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createAccountService } from './account-api'
import AccountScreen from './AccountScreen'

const mockReplace = jest.fn()
const sendCode = jest.fn<ReturnType<typeof createAccountService>['sendCode']>()
const submit = jest.fn<ReturnType<typeof createAccountService>['submit']>()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useLocalSearchParams: () => ({}) }))
jest.mock('@/components/chat-list/theme', () => ({ useChatListColors: () => ({ name: '#111', message: '#777', background: '#fff', badge: '#229af0' }) }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ config: { chat: 'http://test', api: 'http://test', ws: 'ws://test' } }) }))
jest.mock('./AccountScreen', () => {
  process.env.EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED = 'true'
  return jest.requireActual('./AccountScreen')
})
jest.mock('./account-api', () => ({ createAccountService: jest.fn() }))

beforeEach(() => {
  jest.mocked(createAccountService).mockReturnValue({ sendCode, submit })
  sendCode.mockResolvedValue(undefined)
  submit.mockResolvedValue(undefined)
})

it('registration requires matching passwords and nickname before submitting, then returns to login', async () => {
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
  await waitFor(() => expect(screen.getByText('注册成功')).toBeTruthy())
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ mode: 'register', email: 'person@example.com', password: 'secret' }))
  await fireEvent.press(screen.getByRole('button', { name: '返回登录' }))
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
