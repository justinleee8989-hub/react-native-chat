import { Platform } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { launchImageLibraryAsync } from 'expo-image-picker'

// Wide enough for a phone screen at 3x; a larger photo only costs storage and decoding time.
const WIDTH = 1080
const folder = () => new Directory(Paths.document, 'chat-wallpaper')
// Web keeps the photo in local storage, about 5 MB for the whole site; a larger photo would fail to
// save without a word and be gone on the next visit, so it is refused here instead.
const WEB_LIMIT = 3_000_000

/** A photo too large to keep in the browser, even after shrinking. */
export class WallpaperPhotoTooLarge extends Error {}

/**
 * Lets the user pick a photo for the 相册图片 wallpaper (cropped to a portrait screen on Android),
 * shrunk to `WIDTH`, and keeps it on this device: a file in the app's documents on a phone, a data
 * URL on web (which has no file system to keep it in). Resolves to undefined when the picker is
 * closed.
 */
export async function chooseWallpaperPhoto () {
  // Android crops to the portrait screen. iOS's cropper is always square, and a square then filled
  // into a tall chat loses most of the photo, so there the whole photo is kept and centred instead.
  const selection = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: Platform.OS === 'android',
    aspect: [9, 16],
    quality: 1,
  })
  const asset = selection.canceled ? undefined : selection.assets[0]
  if (!asset)
    return undefined
  const context = ImageManipulator.manipulate(asset.uri)
  if ((asset.width || WIDTH) > WIDTH)
    context.resize({ width: WIDTH })
  const image = await context.renderAsync()
  const web = Platform.OS === 'web'
  const result = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG, base64: web })
  if (web) {
    const uri = `data:image/jpeg;base64,${result.base64}`
    if (uri.length > WEB_LIMIT)
      throw new WallpaperPhotoTooLarge()
    return uri
  }
  const directory = folder()
  directory.create({ intermediates: true, idempotent: true })
  // A new name each time, so an Image showing the previous photo does not keep a cached copy.
  const target = new File(directory, `${Date.now()}.jpg`)
  await new File(result.uri).copy(target)
  return target.uri
}

/** Deletes a photo `chooseWallpaperPhoto` kept, once it is no longer the wallpaper. */
export function forgetWallpaperPhoto (uri: string) {
  if (!uri || uri.startsWith('data:'))
    return
  try {
    const file = new File(uri)
    if (file.exists)
      file.delete()
  } catch {
    // Already gone, or never ours: nothing to clean up.
  }
}
