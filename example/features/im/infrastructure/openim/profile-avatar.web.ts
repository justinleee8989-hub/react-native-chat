import { getSDKClient } from './client.web'
import { type AvatarAsset, prepareWebAvatar, uploadProfileAvatar } from './profile-avatar-service'

export async function uploadAvatar (asset: AvatarAsset, current: () => boolean) {
  const sdk = await getSDKClient()
  return uploadProfileAvatar(asset, prepareWebAvatar, async params => (await sdk.uploadFile(params)).data, current)
}
