import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { ConnectionStatus } from '../shared/ConnectionStatus'
import { errorMessage } from '../shared/error-message'
import { ProductError } from '../shared/product-error'
import { translatorFor } from './translate'

let mockChoice = 'en'
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => mockChoice, useProductLayout: () => ({ desktop: false }), useProductScheme: () => 'light' }))

it('a screen picked to show English says its status in English, and follows a change back', async () => {
  const view = await render(<ConnectionStatus status='offline' />)
  expect(screen.getByText('No connection to the server')).toBeTruthy()
  mockChoice = 'zh'
  await view.rerender(<ConnectionStatus status='offline' />)
  expect(screen.getByText('网络异常，无法连接服务器')).toBeTruthy()
})

it('failures are said in the language asked for, from their key or server code', () => {
  const en = translatorFor('en')
  expect(errorMessage(new ProductError('web.resourceFailed', { src: 'sdk.js' }), en)).toBe('Couldn\'t load sdk.js')
  expect(errorMessage({ errCode: 20203, errMsg: 'CallBusy' }, en)).toBe('They\'re on another call.')
  expect(errorMessage({ errCode: 99999, errMsg: 'internal detail /srv/x.go:1' }, en)).toBe('Something went wrong. Please try again.')
  // Two warnings from one connect are both said.
  expect(errorMessage([new ProductError('sync.attachmentRestoreFailed'), new ProductError('extras.unavailable')], en))
    .toBe(`${en('sync.attachmentRestoreFailed')} ${en('extras.unavailable')}`)
})
