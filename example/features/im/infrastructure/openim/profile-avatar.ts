import { File, Paths } from 'expo-file-system'
import { getSDKClient } from './client'
import { type AvatarAsset, uploadProfileAvatar } from './profile-avatar-service'

export async function uploadAvatar (asset: AvatarAsset, current: () => boolean) {
  const sdk = await getSDKClient()
  return uploadProfileAvatar(asset, async value => {
    const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const source = new File(value.uri)
    const name = value.fileName || source.name || 'avatar.jpg'
    const local = new File(Paths.cache, `avatar-${uuid}-${name}`)
    source.copy(local)
    return {
      params: { name, contentType: value.mimeType || 'image/jpeg', uuid, filepath: local.uri.replace('file://', '') },
      dispose: () => {
        if (local.exists) 
          local.delete() 
      },
    }
  }, params => sdk.uploadFile(params), current)
}
