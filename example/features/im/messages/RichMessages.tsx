import React from 'react'
import { Linking, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import type { IMMessage } from '../domain/types'
import { ProductAvatar } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { locationURL } from './composer'
export { RichComposer } from './RichComposer'

export function RichMessage ({
  message,
  onError,
  own,
}: {
  own?: boolean
  message?: IMMessage
  onError: (error: unknown) => void
}) {
  const router = useRouter()
  const t = useProductTheme()
  const card =
    message?.contentType === 108 && message.cardElem?.userID ? message.cardElem : undefined
  const candidate = message?.contentType === 109 ? message.locationElem : undefined
  const location =
    candidate &&
    Number.isFinite(candidate.latitude) &&
    Math.abs(candidate.latitude) <= 90 &&
    Number.isFinite(candidate.longitude) &&
    Math.abs(candidate.longitude) <= 180
      ? candidate
      : undefined
  const open = () => {
    if (card)
      router.push(`/chats/people/${encodeURIComponent(card.userID)}`)
    if (location)
      try {
        void Linking.openURL(
          locationURL({ ...location, description: location.description || '位置' })
        ).catch(onError)
      } catch (error) {
        onError(error)
      }
  }
  const gesture = useTapGesture({
    runOnJS: true,
    cancelsTouchesInView: false,
    onDeactivate: event => {
      if (!event.canceled)
        open()
    },
  })
  if (!card && !location)
    return null
  const color = own ? t.onAccent : t.text
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole='button'
        accessibilityLabel={card ? '查看联系人资料' : '在地图中打开位置'}
        onAccessibilityTap={open}
        style={{ paddingVertical: 12, paddingHorizontal: 14, minWidth: 200 }}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {card ? (
            <ProductAvatar
              id={card.userID}
              title={card.nickname || card.userID}
              uri={card.faceURL}
              size={42}
            />
          ) : (
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
              <ProductIcon name='loc' size={22} color={own ? t.onAccent : t.accent} />
            </View>
          )}
          <View style={{ minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ maxWidth: 170, color, fontSize: 15, lineHeight: 20, fontWeight: '600' }}
            >
              {card ? card.nickname || card.userID : location?.description || '位置'}
            </Text>
            <Text style={{ color, opacity: 0.7, fontSize: 12, lineHeight: 16 }}>
              {card ? `ID：${card.userID}` : `${location?.latitude}, ${location?.longitude}`}
            </Text>
          </View>
        </View>
        <View
          style={{
            marginTop: 10,
            marginHorizontal: -14,
            marginBottom: -12,
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderTopWidth: 0.5,
            borderColor: own ? '#ffffff38' : t.line,
          }}
        >
          <Text style={{ fontSize: 12, color, opacity: 0.7 }}>
            {card ? '个人名片' : '在地图中打开'}
          </Text>
        </View>
      </View>
    </GestureDetector>
  )
}
