import React, { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductModal } from '../ui/ProductModal'

export function ProductImagePreview ({ uri, onClose }: { uri?: string, onClose: () => void }) {
  const tr = useT()
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
          accessibilityLabel={tr('imagePreview.closeBackdrop')}
        >
          {failed === uri ? (
            <Text style={{ color: '#fff', padding: 24 }}>{tr('imagePreview.failed')}</Text>
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
            accessibilityLabel={tr('imagePreview.close')}
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
