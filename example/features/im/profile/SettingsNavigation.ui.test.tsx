import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { profile } from '../application/profile'
import SettingsScreen from './SettingsScreen'

const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = false
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual<object>('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => mockCanGoBack, replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => ({ section: 'profile' }),
}))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: { userID: 'self', imToken: 'token', chatToken: 'chat-token' }, config: { chat: 'https://chat.example.test' } }) }))
jest.mock('../application/profile', () => ({ profile: { self: jest.fn(), blacklist: jest.fn(), updateSelf: jest.fn() } }))
jest.mock('../application/profile-avatar', () => ({ chooseAvatar: jest.fn() }))
jest.mock('../auth/LoginScreen', () => () => null)

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack = false
  jest.mocked(profile.self).mockResolvedValue({ userID: 'self', nickname: '原昵称' })
  jest.mocked(profile.blacklist).mockResolvedValue([])
  jest.mocked(profile.updateSelf).mockResolvedValue(undefined)
})

async function saveChangedNickname () {
  await render(<SettingsScreen />)
  await waitFor(() => expect(screen.getByLabelText('昵称')).toBeTruthy())
  await fireEvent.changeText(screen.getByLabelText('昵称'), '新昵称')
  await fireEvent.press(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => expect(profile.updateSelf).toHaveBeenCalledWith('新昵称', ''))
}

it('replaces to the profile tab after saving when there is no navigation history', async () => {
  await saveChangedNickname()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/me'))
  expect(mockBack).not.toHaveBeenCalled()
})

it('returns with back navigation after saving when history exists', async () => {
  mockCanGoBack = true
  await saveChangedNickname()
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  expect(mockReplace).not.toHaveBeenCalled()
})

it('loads the self email with the active ChatServer session and displays it', async () => {
  jest.mocked(profile.self).mockResolvedValue({ userID: 'self', nickname: '原昵称', email: 'self@example.test' })
  await render(<SettingsScreen />)
  await waitFor(() => expect(screen.getByText('self@example.test')).toBeTruthy())
  expect(profile.self).toHaveBeenCalledWith({
    session: { userID: 'self', imToken: 'token', chatToken: 'chat-token' },
    baseURL: 'https://chat.example.test',
  })
})
