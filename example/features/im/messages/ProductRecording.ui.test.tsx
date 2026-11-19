import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { ProductRecording } from './ProductRecording'

let mockControls: any
let mockVoiceProps: any
jest.mock('@kesha-antonov/react-native-chat', () => ({
  VoiceMessageInput: (props: any) => {
    mockVoiceProps = props
    return props.renderControl(mockControls)
  },
}))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: false }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', text2: '#666', accent: '#06f', onAccent: '#fff', danger: '#f00' }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../application/store', () => ({ reportError: jest.fn() }))

const makeControls = () => ({
  isRecording: false,
  elapsed: 0,
  onStart: jest.fn(async () => {}),
  onCancel: jest.fn(),
  onSend: jest.fn(),
})

it('keeps the recording controls visible while start is pending and cancels the SDK take', async () => {
  let resolveStart!: () => void
  mockControls = makeControls()
  mockControls.onStart.mockImplementation(() => new Promise(resolve => {
    resolveStart = () => resolve(undefined)
  }))
  const onStart = jest.fn()
  const onActiveChange = jest.fn()
  const config = { isEnabled: true }
  const onSend = jest.fn()
  const view = await render(<ProductRecording idleVisible onStart={onStart} onActiveChange={onActiveChange} config={config} onSend={onSend} />)

  expect(mockVoiceProps.config).toBe(config)
  expect(mockVoiceProps.onSend).toBe(onSend)
  await fireEvent.press(view.getByLabelText('录制语音消息'))
  expect(onStart).toHaveBeenCalledTimes(1)
  expect(mockControls.onStart).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(onActiveChange).toHaveBeenLastCalledWith(true))
  expect(view.getByLabelText('录音状态').props.children).toBe('正在请求麦克风…')
  await fireEvent.press(view.getByLabelText('取消录音'))
  expect(mockControls.onCancel).toHaveBeenCalledTimes(1)
  await act(async () => resolveStart())
  await waitFor(() => expect(onActiveChange).toHaveBeenLastCalledWith(false))
  expect(mockControls.onSend).not.toHaveBeenCalled()
})

it('uses cancel when send is pressed before microphone startup finishes', async () => {
  mockControls = makeControls()
  mockControls.onStart.mockImplementation(() => new Promise(() => {}))
  const view = await render(<ProductRecording idleVisible onStart={jest.fn()} onActiveChange={jest.fn()} onSend={jest.fn()} />)

  await fireEvent.press(view.getByLabelText('录制语音消息'))
  expect(view.getByLabelText('录音状态').props.children).toBe('正在请求麦克风…')
  await fireEvent.press(view.getByLabelText('发送语音'))

  expect(mockControls.onCancel).toHaveBeenCalledTimes(1)
  expect(mockControls.onSend).not.toHaveBeenCalled()
})

it('sends through the SDK take once and keeps the active display until the parent state changes', async () => {
  let resolveStop!: () => void
  mockControls = makeControls()
  mockControls.isRecording = true
  mockControls.elapsed = 42000
  mockControls.onSend.mockImplementation(() => new Promise(resolve => {
    resolveStop = () => resolve(undefined)
  }))
  const onActiveChange = jest.fn()
  const onStart = jest.fn()
  const onSend = jest.fn()
  const view = await render(<ProductRecording idleVisible onStart={onStart} onActiveChange={onActiveChange} onSend={onSend} />)

  expect(view.getByLabelText('录音时长').props.children).toBe('00:42')
  const send = view.getByLabelText('发送语音')
  await fireEvent.press(send)
  await fireEvent.press(send)
  expect(mockControls.onSend).toHaveBeenCalledTimes(1)
  expect(mockControls.onCancel).not.toHaveBeenCalled()
  expect(onSend).not.toHaveBeenCalled()
  await fireEvent.press(view.getByLabelText('录制语音消息'))
  expect(onStart).not.toHaveBeenCalled()
  await act(async () => resolveStop())
  await fireEvent.press(view.getByLabelText('录制语音消息'))
  expect(onStart).toHaveBeenCalledTimes(1)
})


it('unlocks the recorder and reports a stop failure instead of leaving it disabled', async () => {
  let rejectStop!: (error: Error) => void
  mockControls = makeControls()
  mockControls.isRecording = true
  mockControls.onSend.mockImplementation(() => new Promise((_, reject) => {
    rejectStop = reject
  }))
  const onStart = jest.fn()
  const view = await render(<ProductRecording idleVisible onStart={onStart} onActiveChange={jest.fn()} onSend={jest.fn()} />)

  await fireEvent.press(view.getByLabelText('发送语音'))
  await fireEvent.press(view.getByLabelText('录制语音消息'))
  expect(onStart).not.toHaveBeenCalled()
  await act(async () => rejectStop(Object.assign(new Error('Voice recorder stop timed out'), { code: 'VOICE_RECORDER_STOP_TIMEOUT' })))
  await fireEvent.press(view.getByLabelText('录制语音消息'))
  await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1))
})
