import React, { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductModal } from '../ui/ProductModal'

export function ProductImagePreview ({ uri, onClose }: { uri?: string, onClose: () => void }) {
  const { desktop } = useProductLayout()
  const insets = useSafeAreaInsets()
  const [failed, setFailed] = useState<string>()
  if (!uri)
    return null
  return (
    <ProductModal onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Pressable
          onPress={onClose}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole='button'
          accessibilityLabel='关闭图片预览背景'
        >
          {failed === uri ? (
            <Text style={{ color: '#fff', padding: 24 }}>图片暂时无法加载，请关闭后重试</Text>
          ) : (
            <Image
              source={{ uri }}
              onError={() => setFailed(uri)}
              resizeMode='contain'
              style={{
                width: desktop ? '80%' : '100%',
                maxWidth: desktop ? 760 : undefined,
                height: desktop ? '72%' : '62%',
                borderRadius: desktop ? 14 : 0,
              }}
            />
          )}
        </Pressable>
        <View style={{ position: 'absolute', top: (desktop ? 0 : insets.top) + 4, right: 8 }}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='关闭图片预览'
            onPress={onClose}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ProductIcon name='close' color='#fff' size={24} />
          </Pressable>
        </View>
      </View>
    </ProductModal>
  )
}
