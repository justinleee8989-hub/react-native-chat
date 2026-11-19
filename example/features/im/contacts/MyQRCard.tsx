import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useT } from '../i18n'
import { useSelfProfile } from '../shared/useSelfProfile'
import { ProductAvatar } from '../ui/primitives'
import { useProductTheme } from '../ui/theme'
import { FriendQRCode } from './FriendQRCode'

/** 我的 → 我的二维码: the user's avatar, name and ID over the QR code of their profile link. */
export function MyQRCard ({ userID }: { userID: string }) {
  const tr = useT()
  const t = useProductTheme()
  const self = useSelfProfile()
  const name = self?.nickname || userID
  return (
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <View style={styles.who}>
        <ProductAvatar id={userID} title={name} uri={self?.faceURL} size={52} />
        <View style={styles.names}>
          <Text numberOfLines={1} style={[styles.name, { color: t.text }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[styles.id, { color: t.text2 }]}>{tr('common.idLabel', { id: userID })}</Text>
        </View>
      </View>
      <View accessible accessibilityLabel={tr('qr.codeOf', { name })} style={styles.code}>
        <FriendQRCode userID={userID} size={220} />
      </View>
      <Text style={[styles.hint, { color: t.text3 }]}>{tr('qr.hint')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 20 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  names: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  id: { fontSize: 13, lineHeight: 18 },
  code: { borderRadius: 10, overflow: 'hidden' },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
})
