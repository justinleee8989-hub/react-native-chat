import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { ProductComposerMenu } from './ProductComposerMenu'
const mockPick = jest.fn<() => Promise<unknown[]>>()
let mockSession = { userID: 'self', imToken: 'first' }
jest.mock('@kesha-antonov/react-native-chat', () => ({ AttachmentMenu: () => null, pickDocuments: () => mockPick(), pickFromSystemGallery: () => mockPick(), takePhoto: () => mockPick() }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: mockSession }), reportError: jest.fn() }))
jest.mock('./RichMessages', () => ({ RichComposer: ({ renderTrigger }: any) => renderTrigger(jest.fn()) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({}) }))
it('opens the selected picker immediately, ignores double taps, and forwards picked files', async () => {
  let resolve!: (value: unknown[]) => void
  mockPick.mockReset().mockImplementation(() => new Promise(done => {
    resolve = done
  }))
  const onSend = jest.fn()
  const view = await render(<ProductComposerMenu visible tabs={['file']} onClose={jest.fn()} onSend={onSend} onLocation={async () => {}} onCard={async () => {}} />)
  await fireEvent.press(view.getByLabelText('文件'))
  await fireEvent.press(view.getByLabelText('文件'))
  expect(mockPick).toHaveBeenCalledTimes(1)
  await act(async () => resolve([{ type: 'file', uri: 'file:///doc', name: 'doc' }]))
  await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
})
it('does not send picker results after switching sessions', async () => {
  let resolve!: (value: unknown[]) => void
  mockPick.mockReset().mockImplementation(() => new Promise(done => {
    resolve = done
  }))
  const onSend = jest.fn()
  const props = { visible: true, tabs: ['file'] as ['file'], onClose: jest.fn(), onSend, onLocation: async () => {}, onCard: async () => {} }
  const view = await render(<ProductComposerMenu {...props} />)
  await fireEvent.press(view.getByLabelText('文件'))
  mockSession = { ...mockSession, imToken: 'second' }
  await view.rerender(<ProductComposerMenu {...props} />)
  await act(async () => resolve([{ type: 'file', uri: 'file:///doc', name: 'doc' }]))
  expect(onSend).not.toHaveBeenCalled()
})
