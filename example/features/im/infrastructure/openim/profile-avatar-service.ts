export interface AvatarAsset {
  uri: string
  fileName?: string | null
  mimeType?: string | null
}
interface Prepared<T> { params: T, dispose: () => void }
export async function uploadProfileAvatar<T> (
  asset: AvatarAsset,
  prepare: (asset: AvatarAsset) => Promise<Prepared<T>>,
  upload: (params: T) => Promise<unknown>,
  current: () => boolean
): Promise<string> {
  if (!current())
    throw new Error('登录状态已变化，请重新选择头像')
  const prepared = await prepare(asset)
  try {
    if (!current())
      throw new Error('登录状态已变化，请重新选择头像')
    const result = await upload(prepared.params)
    if (!current())
      throw new Error('登录状态已变化，请重新选择头像')
    if (!result || typeof result !== 'object' || !('url' in result) || typeof result.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(result.url))
      throw new Error('头像上传响应缺少可访问的图片地址')
    return result.url
  } finally {
    prepared.dispose()
  }
}
export async function prepareWebAvatar (asset: AvatarAsset, request: typeof fetch = fetch) {
  const response = await request(asset.uri)
  if (!response.ok)
    throw new Error('无法读取头像，请重新选择图片')
  const blob = await response.blob()
  const contentType = asset.mimeType || blob.type || 'image/jpeg'
  if (!contentType.startsWith('image/'))
    throw new Error('请选择图片作为头像')
  const name = asset.fileName || `avatar.${contentType.split('/')[1] || 'jpg'}`
  return {
    params: { name, contentType, uuid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: new File([blob], name, { type: contentType }) },
    dispose: () => {},
  }
}
