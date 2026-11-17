import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ProductToast } from '../../shared/ProductToast'
import { useProductLayout } from '../../ui/preferences'
import { ProductHeader } from '../../ui/primitives'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductColors as useChatListColors, useProductTheme } from '../../ui/theme'
import { styles } from './styles'

export function AuthPage ({
  title,
  subtitle,
  children,
  brand = true,
  onBack,
}: React.PropsWithChildren<{
  title: string
  subtitle: string
  brand?: boolean
  onBack?: () => void
}>) {
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
            {brand && (
              <View style={[styles.brand, { backgroundColor: t.text }]}>
                <ProductIcon name='chat' size={30} color={t.bg} />
              </View>
            )}
            <Text style={[styles.title, { color: colors.name }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.message }]}>{subtitle}</Text>
            <View style={styles.fields}>{children}</View>
            {brand && (
              <Text style={[styles.footer, { color: t.text3 }]}>OpenIM · 让沟通更简单</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <ProductToast />
    </SafeAreaView>
  )
}
