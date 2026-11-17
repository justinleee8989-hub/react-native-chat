import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker'
import { uploadAvatar } from '../infrastructure/openim/profile-avatar'
export async function chooseAvatar (current: () => boolean, source: 'library' | 'camera' = 'library') {
  if (!current())
    return undefined
  if (source === 'camera') {
    const permission = await requestCameraPermissionsAsync()
    if (!current())
      return undefined
    if (!permission.granted)
      throw new Error('请允许相机权限后重试')
  }
  const picker = source === 'camera' ? launchCameraAsync : launchImageLibraryAsync
  const selection = await picker({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 })
  if (selection.canceled || !selection.assets[0] || !current())
    return undefined
  return uploadAvatar(selection.assets[0], current)
}
