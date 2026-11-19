import React from 'react'
import { StyleSheet, View } from 'react-native'
import { chatWallpapersOf } from '../ui/chat-wallpaper'
import { ChatWallpaperOf } from '../ui/ChatWallpaperView'
import { setChatWallpaper, useChatWallpaper, useProductLayout } from '../ui/preferences'
import { ProductPage } from '../ui/ProductPage'
import { WallpaperGrid } from '../ui/WallpaperGrid'

/** 聊天壁纸 → 设置颜色: the solid colors as large tiles, each in the current 深色模式. */
export default function ChatWallpaperColorsScreen () {
  const { desktop } = useProductLayout()
  const wallpaper = useChatWallpaper()
  return (
    <ProductPage title='设置颜色' backHref='/chats/chat-wallpaper' busy={false} error=''>
      <View style={[styles.content, { paddingHorizontal: desktop ? 24 : 16 }]}>
        <WallpaperGrid
          items={chatWallpapersOf('color').map(item => ({
            key: item.id,
            label: item.label,
            selected: item.id === wallpaper,
            onPress: () => setChatWallpaper(item.id),
            content: <ChatWallpaperOf id={item.id} />,
          }))}
        />
      </View>
    </ProductPage>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 12, paddingBottom: 24 },
})
