import { expect, it, jest } from '@jest/globals'
import type { Session } from '../../domain/types'
import { createProfileService } from './profile-service'
import type { SelfProfileIdentity } from './self-profile-api'

const session: Session = { userID: 'self-user', imToken: 'im-token', chatToken: 'chat-token' }
const auth = { session, baseURL: 'https://chat.example.test' }
const sdk = {
  getSelfUserInfo: async () => ({ data: { userID: 'self-user', nickname: '昵称' } }),
  setSelfInfo: async () => {},
  getUsersInfo: async () => [],
  getSpecifiedFriendsInfo: async () => [],
  updateFriends: async () => {},
  getBlackList: async () => [],
  addBlack: async () => {},
  removeBlack: async () => {},
}

it('merges the authenticated ChatServer email into the OpenIM self profile', async () => {
  const lookup = jest.fn<(session: Session, baseURL: string) => Promise<SelfProfileIdentity>>()
    .mockResolvedValue({ userID: 'self-user', email: 'self@example.test' })
  const profile = createProfileService(async () => sdk, value => (value as { data: unknown }).data, lookup)
  await expect(profile.self(auth)).resolves.toEqual({ userID: 'self-user', nickname: '昵称', email: 'self@example.test' })
  expect(lookup).toHaveBeenCalledWith(session, auth.baseURL)
})

it('keeps the basic OpenIM profile when the self email lookup fails', async () => {
  const lookup = jest.fn<(session: Session, baseURL: string) => Promise<SelfProfileIdentity>>()
    .mockRejectedValue(new Error('ChatServer unavailable'))
  const profile = createProfileService(async () => sdk, value => (value as { data: unknown }).data, lookup)
  await expect(profile.self(auth)).resolves.toEqual({ userID: 'self-user', nickname: '昵称' })
})

it('does not merge an email returned for a different user', async () => {
  const lookup = jest.fn<(session: Session, baseURL: string) => Promise<SelfProfileIdentity>>()
    .mockResolvedValue({ userID: 'other-user', email: 'other@example.test' })
  const profile = createProfileService(async () => sdk, value => (value as { data: unknown }).data, lookup)
  await expect(profile.self(auth)).resolves.toEqual({ userID: 'self-user', nickname: '昵称' })
})
