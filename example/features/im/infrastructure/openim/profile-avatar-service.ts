import { ProductError } from '../../shared/product-error.ts'
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
    throw new ProductError('avatar.signInChanged')
  const prepared = await prepare(asset)
  try {
    if (!current())
      throw new ProductError('avatar.signInChanged')
    const result = await upload(prepared.params)
    if (!current())
      throw new ProductError('avatar.signInChanged')
    if (!result || typeof result !== 'object' || !('url' in result) || typeof result.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(result.url))
      throw new ProductError('avatar.noURL')
    return result.url
  } finally {
    prepared.dispose()
  }
}
export async function prepareWebAvatar (asset: AvatarAsset, request: typeof fetch = fetch) {
  const response = await request(asset.uri)
  if (!response.ok)
    throw new ProductError('avatar.unreadable')
  const blob = await response.blob()
  const contentType = asset.mimeType || blob.type || 'image/jpeg'
  if (!contentType.startsWith('image/'))
    throw new ProductError('avatar.notImage')
  const name = asset.fileName || `avatar.${contentType.split('/')[1] || 'jpg'}`
  return {
    params: { name, contentType, uuid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: new File([blob], name, { type: contentType }) },
    dispose: () => {},
  }
}
