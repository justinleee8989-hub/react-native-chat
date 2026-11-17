import { beforeEach, expect, it, jest } from '@jest/globals'
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker'
import { chooseAvatar } from '../application/profile-avatar'
import { uploadAvatar } from '../infrastructure/openim/profile-avatar'
jest.mock('expo-image-picker', () => ({ launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn() }))
jest.mock('../infrastructure/openim/profile-avatar', () => ({ uploadAvatar: jest.fn() }))
beforeEach(() => {
  jest.clearAllMocks()
})
it('camera denial never opens capture or uploads', async () => {
  jest.mocked(requestCameraPermissionsAsync).mockResolvedValue({ granted: false } as never)
  await expect(chooseAvatar(() => true, 'camera')).rejects.toThrow('相机权限')
  expect(launchCameraAsync).not.toHaveBeenCalled()
  expect(uploadAvatar).not.toHaveBeenCalled()
})
it('camera cancellation never uploads', async () => {
  jest.mocked(requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
  jest.mocked(launchCameraAsync).mockResolvedValue({ canceled: true, assets: null })
  expect(await chooseAvatar(() => true, 'camera')).toBeUndefined()
  expect(uploadAvatar).not.toHaveBeenCalled()
})
it('session change after picker never uploads', async () => {
  let current = true
  jest.mocked(launchImageLibraryAsync).mockImplementation(async () => {
    current = false; return { canceled: false, assets: [{ uri: 'test://asset', width: 10, height: 10 }] }
  })
  expect(await chooseAvatar(() => current)).toBeUndefined()
  expect(uploadAvatar).not.toHaveBeenCalled()
})
