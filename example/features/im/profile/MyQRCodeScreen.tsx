import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useOpenIM } from '../application/store'
import { MyQRCard } from '../contacts/MyQRCard'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductPage } from '../ui/ProductPage'

/** 我的 → 我的二维码: the user's QR card, for a friend to scan with 扫一扫 or a phone camera. */
export default function MyQRCodeScreen () {
  const tr = useT()
  const { session } = useOpenIM()
  const { desktop } = useProductLayout()
  return (
    <ProductPage title={tr('me.myQRCode')} backHref='/(tabs)/me' busy={false} error=''>
      {session && (
        <View style={[styles.content, { paddingHorizontal: desktop ? 24 : 16 }]}>
          <MyQRCard key={session.userID} userID={session.userID} />
        </View>
      )}
    </ProductPage>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', paddingTop: 24, paddingBottom: 24 },
})
