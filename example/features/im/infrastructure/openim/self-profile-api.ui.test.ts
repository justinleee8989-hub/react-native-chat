import { expect, it, jest } from '@jest/globals'
import type { Session } from '../../domain/types'
import { fetchSelfProfile } from './self-profile-api'

const session: Session = { userID: 'self-user', imToken: 'im-token', chatToken: 'chat-token' }
type Request = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

it('requests the authenticated self endpoint without a client-selected user id', async () => {
  const request = jest.fn<Request>().mockResolvedValue({
    ok: true,
    json: async () => ({ errCode: 0, data: { userID: 'self-user', email: 'self@example.test' } }),
  } as Response)
  const result = await fetchSelfProfile(session, 'https://chat.example.test/', request)
  expect(result).toEqual({ userID: 'self-user', email: 'self@example.test' })
  expect(request).toHaveBeenCalledWith('https://chat.example.test/user/self', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ token: 'chat-token' }),
    body: '{}',
  }))
})

it('rejects a self response for a different account', async () => {
  const request = jest.fn<Request>().mockResolvedValue({
    ok: true,
    json: async () => ({ errCode: 0, data: { userID: 'other-user', email: 'other@example.test' } }),
  } as Response)
  await expect(fetchSelfProfile(session, 'https://chat.example.test', request)).rejects.toThrow(/响应不完整/)
})
