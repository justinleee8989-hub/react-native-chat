import React, { useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import {
  formatFileSize,
  MessageFile,
  type IMessage,
  type MessageFileProps,
} from '@kesha-antonov/react-native-chat'
import * as Sharing from 'expo-sharing'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'

export function ProductFile (props: Partial<MessageFileProps<IMessage>>) {
  const t = useProductTheme()
  const [error, setError] = useState(false)
  const file = props.currentMessage?.file
  const own = props.position === 'right'
  const color = own ? t.onAccent : t.text
  const open = () => {
    if (!file)
      return
    setError(false)
    if (props.onPress)
      props.onPress(file)
    else
      void openProductFile(file).catch(() => setError(true))
  }
  const gesture = useTapGesture({
    runOnJS: true,
    cancelsTouchesInView: false,
    onDeactivate: event => {
      if (!event.canceled)
        open()
    },
  })
  // Transfer controls stay with the SDK until a file is ready to open.
  if (props.currentMessage?.transfer || props.currentMessage?.isDownloadRequired)
    return <MessageFile {...props} />
  if (!file)
    return null
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole='button'
        accessibilityLabel={`${file.name}, ${formatFileSize(file.size)}`}
        onAccessibilityTap={open}
        style={{ minWidth: 200, paddingVertical: 12, paddingHorizontal: 14 }}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: own ? '#ffffff33' : t.accentWeak,
            }}
          >
            <ProductIcon name='file' size={22} color={own ? t.onAccent : t.accent} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color, maxWidth: 170, fontSize: 15, lineHeight: 20, fontWeight: '600' }}
            >
              {file.name}
            </Text>
            <Text style={{ color, opacity: 0.7, fontSize: 12, lineHeight: 16 }}>
              {formatFileSize(file.size)}
            </Text>
          </View>
        </View>
        {error && (
          <Text accessibilityRole='alert' style={{ color, fontSize: 12, marginTop: 8 }}>
            文件暂时无法打开，请重试
          </Text>
        )}
      </View>
    </GestureDetector>
  )
}

async function openProductFile (file: NonNullable<IMessage['file']>) {
  if (
    Platform.OS !== 'web' &&
    /^(file|content):/.test(file.uri) &&
    (await Sharing.isAvailableAsync())
  )
    try {
      await Sharing.shareAsync(file.uri, { mimeType: file.mimeType, dialogTitle: file.name })
      return
    } catch {
      // Some native providers cannot share a URI; keep the SDK's open fallback.
    }

  await Linking.openURL(file.uri)
}
