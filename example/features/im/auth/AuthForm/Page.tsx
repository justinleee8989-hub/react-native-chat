import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useT } from '../../i18n'
import { ProductToast } from '../../shared/ProductToast'
import { useProductLayout } from '../../ui/preferences'
import { ProductHeader } from '../../ui/primitives'
import { useProductColors as useChatListColors, useProductTheme } from '../../ui/theme'
import { type AuthMood, AuthMascot } from './Mascot'
import { styles } from './styles'

export function AuthPage ({
  title,
  subtitle,
  children,
  brand = true,
  mood,
  typed,
  end,
  onBack,
}: React.PropsWithChildren<{
  title: string
  subtitle: string
  brand?: boolean
  /** What the form is doing, for the sprite in the brand mark to act out. */
  mood?: AuthMood
  /** The email's length, for the sprite to follow as it is typed. */
  typed?: number
  /** Below the form, at the bottom of a phone's screen: the way to another page. */
  end?: React.ReactNode
  onBack?: () => void
}>) {
  const tr = useT()
  const colors = useChatListColors()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      {onBack && (
        <View style={{ width: '100%', maxWidth: desktop ? 440 : undefined, alignSelf: 'center' }}>
          <ProductHeader detail title='' onBack={onBack} backgroundColor={t.page} />
        </View>
      )}
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={[styles.page, { paddingTop: brand ? (desktop ? 72 : 28) : 8 }]}
        >
          <View style={styles.form}>
            {brand && <AuthMascot mood={mood} typed={typed} />}
            <Text style={[styles.title, { color: colors.name }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.message }]}>{subtitle}</Text>
            <View style={styles.fields}>{children}</View>
            {!!end && (
              <>
                <View style={desktop ? { height: 24 } : styles.endSpacer} />
                {end}
              </>
            )}
            {brand && (
              <Text style={[styles.footer, { color: t.text3 }]}>{tr('auth.footer')}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ProductToast />
    </SafeAreaView>
  )
}
