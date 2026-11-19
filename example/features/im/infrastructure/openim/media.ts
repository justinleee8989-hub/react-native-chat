import SDK from '@openim/rn-client-sdk'
import { File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { createVideoPlayer } from 'expo-video'
import type { MediaInput } from '../../domain/types'

export async function createNativeMedia (media: MediaInput) {
  // Content-provider URIs must be copied to a path the native OpenIM core can open.
  const original = new File(media.uri)
  const local = new File(
    Paths.cache,
    `openim-${Date.now()}-${original.name || media.name || media.type}`
  )
  await original.copy(local)
  const path = local.uri.replace('file://', '')
  if (media.type === 'image')
    return SDK.createImageMessageFromFullPath(path)
  if (media.type === 'audio')
    return SDK.createSoundMessageFromFullPath({
      soundPath: path,
      duration: Math.max(1, Math.round(media.duration || 1)),
    })
  if (media.type === 'video') {
    const player = createVideoPlayer(local.uri)
    try {
      const [thumbnail] = await player.generateThumbnailsAsync(0)
      const image = await ImageManipulator.manipulate(thumbnail).renderAsync()
      const snapshot = await image.saveAsync({ format: SaveFormat.JPEG })
      return await SDK.createVideoMessageFromFullPath({
        videoPath: path,
        videoType: media.mimeType || 'video/mp4',
        duration: Math.max(1, Math.round(media.duration || player.duration || 1)),
        snapshotPath: snapshot.uri.replace('file://', ''),
      })
    } finally {
      player.release()
    }
  }
  return SDK.createFileMessageFromFullPath({
    filePath: path,
    // Sent as the file's name, so it is not in the sender's language.
    fileName: media.name || original.name || 'file',
  })
}
