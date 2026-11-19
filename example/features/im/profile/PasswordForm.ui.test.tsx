import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { changePassword } from '../application/profile'
import { logout } from '../application/store'
import PasswordForm from './PasswordForm'

jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('@/components/chat-list/theme', () => ({
  useChatListColors: () => ({ message: '#333', name: '#111', divider: '#ccc' }),
}))
jest.mock('../application/profile', () => ({ changePassword: jest.fn() }))
jest.mock('../application/store', () => ({
  logout: jest.fn(),
  useOpenIM: () => ({ session: { userID: 'isolated-test', imToken: 'fake-im', chatToken: 'fake' }, config: { chat: 'http://local-test' } }),
}))
jest.mock('../shared/shared', () => {
  const { Text, Pressable } = require('react-native')
  return {
    styles: { input: {} },
    Label: ({ children }: any) => <Text>{children}</Text>,
    Action: ({ title, disabled, onPress }: any) => <Pressable accessibilityRole='button' accessibilityLabel={title} disabled={disabled} onPress={onPress}><Text>{title}</Text></Pressable>,
    Confirm: ({ message, busy, onConfirm, onCancel }: any) => <>
      <Text>{message}</Text>
      <Pressable accessibilityRole='button' accessibilityLabel='确认' disabled={busy} onPress={onConfirm}><Text>确认</Text></Pressable>
      <Pressable accessibilityRole='button' accessibilityLabel='取消' disabled={busy} onPress={onCancel}><Text>取消</Text></Pressable>
    </>,
  }
})

async function fillValid () {
  await fireEvent.changeText(screen.getByLabelText('当前密码'), 'old-test')
  await fireEvent.changeText(screen.getByLabelText('新密码'), 'new-test')
  await fireEvent.changeText(screen.getByLabelText('确认新密码'), 'new-test')
}

it('does not submit empty, matching-current, or mismatched passwords', async () => {
  await render(<PasswordForm />)
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  expect(changePassword).not.toHaveBeenCalled()
  await fillValid()
  await fireEvent.changeText(screen.getByLabelText('确认新密码'), 'different')
  expect(screen.getByText('两次输入的密码不一致')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  expect(screen.queryByText('确认修改密码并退出登录？')).toBeNull()
  await fireEvent.changeText(screen.getByLabelText('新密码'), 'old-test')
  await fireEvent.changeText(screen.getByLabelText('确认新密码'), 'old-test')
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  expect(changePassword).not.toHaveBeenCalled()
})

it('cancel leaves password unchanged', async () => {
  await render(<PasswordForm />)
  await fillValid()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  await fireEvent.press(screen.getByRole('button', { name: '取消' }))
  expect(changePassword).not.toHaveBeenCalled()
  expect(logout).not.toHaveBeenCalled()
})

it('successful confirmation calls the real application contract then logs out', async () => {
  jest.mocked(changePassword).mockResolvedValue(undefined)
  await render(<PasswordForm />)
  await fillValid()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '确认' })) 
  })
  expect(changePassword).toHaveBeenCalledWith({ userID: 'isolated-test', imToken: 'fake-im', chatToken: 'fake' }, 'old-test', 'new-test', 'http://local-test')
  expect(logout).toHaveBeenCalledWith('password.changed')
})

it('rejected change displays error and does not log out', async () => {
  jest.mocked(changePassword).mockRejectedValue({ errCode: 20001, errMsg: 'PasswordError' })
  await render(<PasswordForm />)
  await fillValid()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: '确认' })) 
  })
  expect(screen.getByText('账号或密码错误')).toBeTruthy()
  expect(logout).not.toHaveBeenCalled()
})

it('does not send twice while a password change is pending', async () => {
  let finish!: () => void
  jest.mocked(changePassword).mockImplementation(() => new Promise<void>(resolve => {
    finish = resolve 
  }))
  await render(<PasswordForm />)
  await fillValid()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  await fireEvent.press(screen.getByRole('button', { name: '确认' }))
  await fireEvent.press(screen.getByRole('button', { name: '确认' }))
  expect(changePassword).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish() 
  })
  expect(logout).toHaveBeenCalledTimes(1)
})

it('late success after leaving the form does not log out another screen', async () => {
  let finish!: () => void
  jest.mocked(changePassword).mockImplementation(() => new Promise<void>(resolve => {
    finish = resolve 
  }))
  const view = await render(<PasswordForm />)
  await fillValid()
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  await fireEvent.press(screen.getByRole('button', { name: '确认' }))
  await view.unmount()
  await act(async () => {
    finish() 
  })
  expect(logout).not.toHaveBeenCalled()
})

it('does not offer confirmation for a password shorter than six characters', async () => {
  await render(<PasswordForm />)
  await fireEvent.changeText(screen.getByLabelText('当前密码'), 'old-password')
  await fireEvent.changeText(screen.getByLabelText('新密码'), '12345')
  await fireEvent.changeText(screen.getByLabelText('确认新密码'), '12345')
  await fireEvent.press(screen.getByRole('button', { name: '修改密码' }))
  expect(screen.queryByText('确认修改密码并退出登录？')).toBeNull()
})
