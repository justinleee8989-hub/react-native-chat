import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type Language, languageNames, useLanguage, useT } from '../i18n'
import { setLanguageChoice, useLanguageChoice, useProductLayout } from '../ui/preferences'
import { ProductCard, ProductRow, ProductSwitch } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPage, ProductSection } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'

const languages: Language[] = ['zh', 'en']

/**
 * 我的 → 语言, laid out like 深色模式: it follows the system, and only with 跟随系统 off offers the
 * languages to pick from. A choice applies at once, on every screen, and is kept on this device.
 */
export default function LanguageScreen () {
  const t = useProductTheme()
  const tr = useT()
  const { desktop } = useProductLayout()
  const choice = useLanguageChoice()
  const language = useLanguage()
  const followSystem = choice === 'auto'
  return (
    <ProductPage title={tr('language.title')} backHref='/(tabs)/me' busy={false} error=''>
      <View style={[styles.content, { paddingHorizontal: desktop ? 24 : 16 }]}>
        <ProductSection variant='list'>{tr('language.title')}</ProductSection>
        <ProductCard>
          <ProductRow
            title={tr('language.followSystem')}
            trailing={
              <ProductSwitch
                accessibilityLabel={tr('language.followSystem')}
                value={followSystem}
                // Turned off, the app keeps the language it shows now until another is chosen.
                onValueChange={on => setLanguageChoice(on ? 'auto' : language)}
              />
            }
          />
          {!followSystem && languages.map(value => (
            <ProductRow
              key={value}
              title={languageNames[value]}
              trailing={choice === value ? <ProductIcon name='check' size={20} color={t.accent} /> : undefined}
              chevron={false}
              onPress={() => setLanguageChoice(value)}
            />
          ))}
        </ProductCard>
        <Text style={[styles.hint, { color: t.text3 }]}>
          {followSystem ? tr('language.followSystemHint') : tr('language.fixedHint')}
        </Text>
      </View>
    </ProductPage>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingBottom: 24 },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8 },
})
