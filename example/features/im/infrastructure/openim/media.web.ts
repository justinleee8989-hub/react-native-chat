import type { getSDK } from '@openim/wasm-client-sdk'
import type { MediaInput } from '../../domain/types'

async function videoSnapshot (uri: string) {
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('视频预览加载超时')), 20000)
      video.onloadeddata = () => {
        clearTimeout(timer)
        resolve()
      }
      video.onerror = () => {
        clearTimeout(timer)
        reject(new Error('无法读取视频'))
      }
      video.src = uri
    })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('无法创建视频预览')
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        value => (value ? resolve(value) : reject(new Error('无法创建视频预览'))),
        'image/jpeg'
      )
    )
    return {
      file: new File([blob], 'snapshot.jpg', { type: 'image/jpeg' }),
      width: canvas.width,
      height: canvas.height,
      duration: video.duration,
    }
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

export async function createWebMedia (sdk: ReturnType<typeof getSDK>, media: MediaInput) {
  const response = await fetch(media.uri)
  if (!response.ok)
    throw new Error('无法读取附件，请重新选择文件')
  const blob = await response.blob()
  const mime = media.mimeType || blob.type
  const extension = mime.split('/')[1]?.split(';')[0] || 'bin'
  const file = new File([blob], media.name || `${media.type}.${extension}`, { type: mime })
  const uuid = crypto.randomUUID()
  if (media.type === 'image') {
    const bitmap = await createImageBitmap(blob)
    const picture = {
      uuid,
      type: mime,
      size: file.size,
      width: media.width || bitmap.width,
      height: media.height || bitmap.height,
      url: '',
    }
    bitmap.close()
    return (
      await sdk.createImageMessageByFile({
        file,
        sourcePath: media.uri,
        sourcePicture: picture,
        bigPicture: picture,
        snapshotPicture: picture,
      })
    ).data
  }
  if (media.type === 'audio')
    return (
      await sdk.createSoundMessageByFile({
        file,
        uuid,
        soundPath: media.uri,
        sourceUrl: '',
        dataSize: file.size,
        duration: Math.max(1, Math.round(media.duration || 1)),
        soundType: mime,
      })
    ).data
  if (media.type === 'video') {
    const snapshot = await videoSnapshot(media.uri)
    return (
      await sdk.createVideoMessageByFile({
        videoFile: file,
        snapshotFile: snapshot.file,
        videoPath: media.uri,
        duration: Math.max(1, Math.round(media.duration || snapshot.duration)),
        videoType: mime,
        snapshotPath: '',
        videoUUID: uuid,
        videoUrl: '',
        videoSize: file.size,
        snapshotUUID: crypto.randomUUID(),
        snapshotSize: snapshot.file.size,
        snapshotUrl: '',
        snapshotWidth: snapshot.width,
        snapshotHeight: snapshot.height,
        snapShotType: 'image/jpeg',
      })
    ).data
  }
  return (
    await sdk.createFileMessageByFile({
      file,
      uuid,
      filePath: media.uri,
      fileName: file.name,
      sourceUrl: '',
      fileSize: file.size,
      fileType: mime,
    })
  ).data
}
