import React from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { ChatWallpaper } from '@kesha-antonov/react-native-chat'
import { type ChatWallpaperId, resolveChatWallpaper, type ResolvedChatWallpaper } from './chat-wallpaper'
import { useChatWallpaper, useChatWallpaperPhoto, useProductScheme } from './preferences'
import { chatPattern } from './ProductChatTheme'
import { useProductTheme } from './theme'

/** What a wallpaper draws now: the saved one, or `id`, in the current scheme. */
export function useResolvedChatWallpaper (id?: ChatWallpaperId) {
  const saved = useChatWallpaper()
  return resolveChatWallpaper(id ?? saved, useProductScheme(), useChatWallpaperPhoto())
}

/** A photo wallpaper, darkened at night so it does not glare behind the messages. */
export function ChatPhotoWallpaper ({ uri }: { uri: string }) {
  const night = useProductScheme() === 'dark'
  return (
    <View pointerEvents='none' style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} resizeMode='cover' style={StyleSheet.absoluteFill} />
      {night && <View style={[StyleSheet.absoluteFill, styles.night]} />}
    </View>
  )
}

/**
 * Any wallpaper, filling its parent: for the 外观 preview and the choices' thumbnails. A chat draws
 * its own (the library animates the gradient as messages are sent).
 */
export function ChatWallpaperView ({ wallpaper }: { wallpaper: ResolvedChatWallpaper }) {
  const t = useProductTheme()
  const color = wallpaper.kind === 'color' ? wallpaper.color : t.bg
  return (
    <View pointerEvents='none' style={[StyleSheet.absoluteFill, { backgroundColor: color }]}>
      {wallpaper.kind === 'gradient' && <ChatWallpaper colors={wallpaper.colors} pattern={chatPattern} isAnimated={false} />}
      {wallpaper.kind === 'photo' && <ChatPhotoWallpaper uri={wallpaper.uri} />}
    </View>
  )
}

/**
 * The chat page's `renderWallpaper` for a photo wallpaper, or undefined to let the theme draw the
 * gradient or color (the library animates a gradient as messages are sent).
 */
export function usePhotoWallpaperRender () {
  const wallpaper = useResolvedChatWallpaper()
  const photo = wallpaper.kind === 'photo' ? wallpaper.uri : undefined
  return photo ? () => <ChatPhotoWallpaper uri={photo} /> : undefined
}

/** The wallpaper `id` stands for (a photo choice shows the saved photo), filling its parent. */
export function ChatWallpaperOf ({ id }: { id: ChatWallpaperId }) {
  return <ChatWallpaperView wallpaper={useResolvedChatWallpaper(id)} />
}

const styles = StyleSheet.create({
  night: { backgroundColor: 'rgba(0,0,0,0.38)' },
})
