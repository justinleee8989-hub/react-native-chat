import React from 'react'
import { ScrollView, View } from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Confirm } from './shared'

const mockModal = jest.fn<(props: {
  visible?: boolean
  onRequestClose?: () => void
  children?: React.ReactElement<{ accessibilityViewIsModal?: boolean }>
}) => void>()
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => {
      mockModal(props)
      return React.createElement(View, { testID: props.testID }, props.children)
    },
  }
})
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false }) }))
jest.mock('../ui/theme', () => ({
  useProductTheme: () => ({ surface: '#fff', scrim: 'rgba(0,0,0,.4)' }),
  useProductColors: () => ({ name: '#111', message: '#777', background: '#fff', attachment: '#229af0', pressed: '#eee', draft: '#c00' }),
}))

beforeEach(() => {
  mockModal.mockClear()
})

it('presents the confirmation in a visible Modal when rendered inside a scroll page', async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  await render(
    <ScrollView testID='page-scroll'>
      <View style={{ height: 2000 }} />
      <Confirm message='退出群组？' busy={false} onConfirm={onConfirm} onCancel={onCancel} />
    </ScrollView>
  )

  expect(screen.getByTestId('confirmation-modal')).toBeTruthy()
  const modalProps = mockModal.mock.calls[0][0]
  expect(modalProps).toEqual(expect.objectContaining({
    testID: 'confirmation-modal',
    visible: true,
    transparent: true,
  }))
  expect(modalProps.children).toBeTruthy()
  expect(modalProps.children?.props.accessibilityViewIsModal).toBe(true)
  expect(onConfirm).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
})

it('calls confirm and cancel only from their respective buttons', async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  await render(<Confirm message='确定？' busy={false} onConfirm={onConfirm} onCancel={onCancel} />)

  await fireEvent.press(screen.getByRole('button', { name: '确认' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onCancel).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: '取消' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})

it('disables both buttons and ignores Android back while busy', async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  await render(<Confirm message='处理中' busy onConfirm={onConfirm} onCancel={onCancel} />)

  expect(screen.getByRole('button', { name: '确认' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.getByRole('button', { name: '取消' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: '确认' }))
  await fireEvent.press(screen.getByRole('button', { name: '取消' }))
  const onRequestClose = mockModal.mock.calls[0][0].onRequestClose
  onRequestClose?.()
  expect(onConfirm).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
})

it('uses Android back as cancel while idle and never confirms implicitly', async () => {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  await render(<Confirm message='退出群组？' busy={false} onConfirm={onConfirm} onCancel={onCancel} />)

  const onRequestClose = mockModal.mock.calls[0][0].onRequestClose
  onRequestClose?.()
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

it('keeps an operation error visible and allows retry while idle', async () => {
  const onConfirm = jest.fn()
  const props = {
    message: '操作失败后可重试',
    busy: false,
    onConfirm,
    onCancel: jest.fn(),
    error: '群操作失败',
  } as React.ComponentProps<typeof Confirm> & { error: string }
  await render(<Confirm {...props} />)

  expect(screen.getByRole('alert').props.children).toBe('群操作失败')
  const confirm = screen.getByRole('button', { name: '确认' })
  expect(confirm.props.accessibilityState.disabled).not.toBe(true)
  await fireEvent.press(confirm)
  expect(onConfirm).toHaveBeenCalledTimes(1)
})
