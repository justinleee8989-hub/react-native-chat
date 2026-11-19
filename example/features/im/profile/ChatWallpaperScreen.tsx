import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type Href } from 'expo-router'
import { chooseWallpaperPhoto, forgetWallpaperPhoto, WallpaperPhotoTooLarge } from '../application/chat-wallpaper-photo'
import { useT } from '../i18n'
import { useMasterNavigation } from '../navigation/DesktopNavigation'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { chatWallpapersOf, resolveChatWallpaper } from '../ui/chat-wallpaper'
import { ChatWallpaperOf, ChatWallpaperView } from '../ui/ChatWallpaperView'
import {
  setChatWallpaper,
  setChatWallpaperPhoto,
  useChatWallpaper,
  useChatWallpaperPhoto,
  useProductLayout,
  useProductScheme,
} from '../ui/preferences'
import { ProductCard, ProductRow } from '../ui/primitives'
import { ProductPage } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { WallpaperGrid } from '../ui/WallpaperGrid'

/**
 * 外观 → 聊天壁纸: rows into 设置颜色 and the photo album, then the wallpapers as large tiles (the
 * picked photo first, then 默认 and the swirl gradients). A tap applies at once.
 */
export default function ChatWallpaperScreen () {
  const tr = useT()
  const t = useProductTheme()
  const scheme = useProductScheme()
  const { desktop } = useProductLayout()
  const wallpaper = useChatWallpaper()
  const photo = useChatWallpaperPhoto()
  const openMaster = useMasterNavigation()
  const task = useTask()
  const resolved = resolveChatWallpaper(wallpaper, scheme, photo)
  const pickPhoto = () => {
    void task.run(async alive => {
      const uri = await chooseWallpaperPhoto().catch(reason => {
        showProductToast(reason instanceof WallpaperPhotoTooLarge ? tr('wallpaper.tooLarge') : tr('wallpaper.unusable'))
        return undefined
      })
      if (!uri || !alive())
        return
      forgetWallpaperPhoto(photo)
      setChatWallpaperPhoto(uri)
      setChatWallpaper('photo')
    })
  }
  const removePhoto = () => {
    forgetWallpaperPhoto(photo)
    setChatWallpaperPhoto('')
    if (wallpaper === 'photo')
      setChatWallpaper('plain')
  }
  const photoTile = photo
    ? [{
      key: 'photo',
      label: tr('wallpaper.photo'),
      selected: wallpaper === 'photo',
      onPress: () => setChatWallpaper('photo'),
      content: <ChatWallpaperView wallpaper={{ kind: 'photo', uri: photo }} />,
    }]
    : []
  const presetTiles = [...chatWallpapersOf('plain'), ...chatWallpapersOf('gradient')].map(item => ({
    key: item.id,
    label: tr(item.labelKey),
    selected: item.id === wallpaper,
    onPress: () => setChatWallpaper(item.id),
    content: <ChatWallpaperOf id={item.id} />,
  }))
  return (
    <ProductPage title={tr('wallpaper.title')} backHref='/chats/appearance' busy={task.busy} error=''>
      <View style={[styles.content, { paddingHorizontal: desktop ? 24 : 16 }]}>
        <ProductCard>
          <ProductRow
            title={tr('wallpaper.setColor')}
            chevron
            trailing={
              resolved.kind === 'color'
                ? <View style={[styles.dot, { backgroundColor: resolved.color, borderColor: t.line }]} />
                : undefined
            }
            onPress={() => openMaster('/chats/chat-wallpaper-colors' as Href)}
          />
          <ProductRow title={photo ? tr('wallpaper.changePhoto') : tr('wallpaper.choosePhoto')} chevron={false} onPress={pickPhoto} />
          {!!photo && <ProductRow title={tr('wallpaper.removePhoto')} danger chevron={false} onPress={removePhoto} />}
        </ProductCard>
        <Text style={[styles.hint, { color: t.text3 }]}>
          {tr('wallpaper.photoHint')}
        </Text>
        <WallpaperGrid items={[...photoTile, ...presetTiles]} />
      </View>
    </ProductPage>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 12, paddingBottom: 24 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
})
