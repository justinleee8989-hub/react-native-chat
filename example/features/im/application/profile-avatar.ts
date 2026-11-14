import { launchImageLibraryAsync } from 'expo-image-picker'
import { uploadAvatar } from '../infrastructure/openim/profile-avatar'

export async function chooseAvatar (current: () => boolean) {
  const selection = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 })
  if (selection.canceled || !selection.assets[0] || !current())
    return undefined
  return uploadAvatar(selection.assets[0], current)
}
