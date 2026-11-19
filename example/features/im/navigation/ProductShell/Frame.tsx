import React from 'react'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import { usePathname } from 'expo-router'
import { useT } from '../../i18n'
import { useProductLayout, setPhonePreview } from '../../ui/preferences'
import { useProductTheme } from '../../ui/theme'
import { DesktopNavigationProvider } from '../DesktopNavigation'
import { isDesktopProduct } from '../layout'
import { styles } from './styles'

export function ProductFrame ({ children }: React.PropsWithChildren) {
  const tr = useT()
  const { width } = useWindowDimensions()
  const t = useProductTheme()
  const layout = useProductLayout()
  const path = usePathname()
  const product = !path.startsWith('/explore') && !path.startsWith('/chat/')
  const phonePreview = product && layout.phonePreview
  const desktop = isDesktopProduct(width) && product
  return (
    <DesktopNavigationProvider>
      <View style={[styles.stage, { backgroundColor: t.stage }, desktop && styles.stageDesktop]}>
        <View
          style={[
            styles.frame,
            { backgroundColor: t.bg },
            desktop && [
              styles.frameDesktop,
              { boxShadow: `0 0 0 1px ${t.line}, 0 40px 90px -40px rgba(0,0,0,.4)` },
            ],
            phonePreview && { maxWidth: 390, maxHeight: 844 },
          ]}
        >
          {phonePreview && (
            <Pressable
              accessibilityRole='button'
              onPress={() => setPhonePreview(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: t.accent, textAlign: 'center' }}>{tr('shell.backToDesktop')}</Text>
            </Pressable>
          )}
          {children}
        </View>
      </View>
    </DesktopNavigationProvider>
  )
}
