import { expect, it, jest } from '@jest/globals'
import type { Session } from '../../domain/types'
import { findUserIDByContact } from './contact-lookup-api'

const session: Session = { userID: 'self-user', imToken: 'im-token', chatToken: 'chat-token' }
type Request = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
const reply = (body: unknown) => jest.fn<Request>().mockResolvedValue({ ok: true, json: async () => body } as Response)

it('posts the phone number to the exact contact endpoint with the chat token', async () => {
  const request = reply({ errCode: 0, data: { user: { userID: 'bob', email: '' } } })
  const contact = { areaCode: '+86', phoneNumber: '13800138000' }
  await expect(findUserIDByContact(session, 'https://chat.example.test/', contact, request)).resolves.toBe('bob')
  expect(request).toHaveBeenCalledWith('https://chat.example.test/user/find/contact', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ token: 'chat-token' }),
    body: JSON.stringify(contact),
  }))
})

it('answers undefined when no account has the email', async () => {
  const request = reply({ errCode: 0, data: {} })
  await expect(findUserIDByContact(session, 'https://chat.example.test', { email: 'nobody@example.test' }, request))
    .resolves.toBeUndefined()
})

it('surfaces the server error', async () => {
  const request = reply({ errCode: 1001, errMsg: 'ArgsError' })
  await expect(findUserIDByContact(session, 'https://chat.example.test', { email: 'x@example.test' }, request))
    .rejects.toThrow('ArgsError')
})

it('needs a chat token', async () => {
  await expect(findUserIDByContact({ ...session, chatToken: '' }, 'https://chat.example.test', { email: 'x@example.test' }))
    .rejects.toThrow(/重新登录/)
})
