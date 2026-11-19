import React from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { useT } from '../i18n'
import { useProductTheme } from '../ui/theme'

/** Product UI only: authentication and native splash timing stay in their existing owners. */
export function StartupScreen ({ onContinue }: { onContinue?: () => void }) {
  const tr = useT()
  const t = useProductTheme()
  return (
    <View testID='product-startup' style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: t.bg }]} accessibilityViewIsModal onLayout={SplashScreen.hide}>
      <Image source={require('../../../assets/images/product-startup.png')} style={styles.mark} accessibilityLabel={tr('tab.chats')} />
      <View style={styles.caption}>
        <Text style={[styles.title, { color: t.text }]}>{tr('tab.chats')}</Text>
        <Text style={[styles.subtitle, { color: t.text2 }]}>{tr('startup.tagline')}</Text>
      </View>
      <View style={styles.status} accessibilityLiveRegion='polite'>
        <ActivityIndicator size='small' color={t.accent} />
        <Text style={{ color: t.text3, fontSize: 12 }}>{onContinue ? tr('startup.slow') : tr('startup.preparing')}</Text>
        {onContinue && (
          <Pressable accessibilityRole='button' onPress={onContinue} style={{ padding: 12 }}>
            <Text style={{ color: t.accent, fontSize: 14 }}>{tr('startup.continue')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center' },
  mark: { width: 108, height: 108 },
  caption: { position: 'absolute', top: '50%', marginTop: 78, alignItems: 'center', gap: 10 },
  title: { fontSize: 27, fontWeight: '700', letterSpacing: 2 },
  subtitle: { fontSize: 14, letterSpacing: 1 },
  status: { position: 'absolute', bottom: 58, alignItems: 'center', gap: 12 },
})
