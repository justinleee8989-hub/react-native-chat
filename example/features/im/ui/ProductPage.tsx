import React from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { offlineStatus, useConnectionStatus } from '../application/connection-status'
import { useDesktopNavigation } from '../navigation/DesktopNavigation'
import { ProductToast } from '../shared/ProductToast'
import { useProductLayout } from './preferences'
import { ProductHeader } from './primitives'
import { ProductIcon } from './ProductIcon'
import { ProductPressable as Pressable } from './ProductPressable'
import { ProductSkeleton, type ProductSkeletonKind } from './ProductSkeleton'
import { useProductTheme } from './theme'

export function ProductPage ({
  title,
  subtitle,
  root,
  busy,
  error,
  right,
  children,
  headerContent,
  white = false,
  alwaysShowBack = false,
  initialLoading = false,
  loading = false,
  skeleton = 'list',
  skeletonGroup = false,
  onRetry,
  backHref = '/(tabs)/contacts',
}: React.PropsWithChildren<{
  title: string
  subtitle?: string
  root?: boolean
  busy: boolean
  error: string
  right?: React.ReactNode
  headerContent?: React.ReactNode
  white?: boolean
  alwaysShowBack?: boolean
  /** The first load has not finished: `children` are replaced by a `skeleton` of the page's shape. */
  initialLoading?: boolean
  /**
   * The first load has not finished, and the page draws its own structure with placeholders only
   * where the data goes. Preferred when the structure does not depend on the data.
   */
  loading?: boolean
  skeleton?: ProductSkeletonKind
  /** The `profile` skeleton stands in for a group (rounded-square avatar). */
  skeletonGroup?: boolean
  onRetry?: () => void
  backHref?: Href
}>) {
  const router = useRouter()
  const navigation = useDesktopNavigation()
  const { desktop } = useProductLayout()
  const t = useProductTheme()
  // The inset is padded from JS, not by SafeAreaView: a native SafeAreaView applies it a frame after
  // it mounts, so a tab opened for the first time drew its title under the status bar, then jumped.
  const insets = useSafeAreaInsets()
  // Offline, every page's requests fail with whatever the SDK says (often 操作失败); the page says
  // only that the network is down, the same as the chat list.
  const connection = useConnectionStatus()
  const shownError = error && connection === offlineStatus ? offlineStatus : error
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: white ? t.page : t.bg }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: !root && desktop ? 680 : undefined,
          alignSelf: 'center',
        }}
      >
        <ProductHeader
          detail={!root}
          backgroundColor={white ? t.page : t.bg}
          title={title}
          subtitle={subtitle}
          large={root}
          right={right}
          onBack={
            !alwaysShowBack && (root || (desktop && navigation?.canGoBackInSection === false))
              ? undefined
              : () => {
                if (router.canGoBack())
                  router.back()
                else
                  router.replace(backHref)
              }
          }
        />
        {headerContent}
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {!!error && (
              <Text accessibilityRole='alert' style={{ padding: 16, color: t.danger }}>
                {shownError}
              </Text>
            )}
            {(initialLoading || loading) && !!error && onRetry && (
              <Pressable accessibilityRole='button' accessibilityLabel='重新加载' disabled={busy} onPress={onRetry} style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: t.accent }}>重新加载</Text>
              </Pressable>
            )}
            {initialLoading
              ? !error && <ProductSkeleton kind={skeleton} group={skeletonGroup} />
              : children}
          </ScrollView>
          {/* Floats over the content: in the flow it pushed the page down on every refresh (pages
              refresh on focus), and back up when the refresh ended. */}
          {busy && !initialLoading && !loading && (
            <ActivityIndicator accessibilityLabel='正在处理' color={t.accent} style={styles.busy} pointerEvents='none' />
          )}
        </View>
        <ProductToast />
      </View>
    </View>
  )
}
export function ProductIconButton ({
  name,
  label,
  onPress,
}: {
  name: React.ComponentProps<typeof ProductIcon>['name']
  label: string
  onPress: () => void
}) {
  const t = useProductTheme()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.surface2 : undefined,
      })}
    >
      <ProductIcon name={name} color={t.text} />
    </Pressable>
  )
}
export function ProductSection ({
  children,
  variant = 'group',
  side = false,
}: React.PropsWithChildren<{ variant?: 'group' | 'list', side?: boolean }>) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  return (
    <Text
      style={{
        color: t.text2,
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: variant === 'group' ? 32 : 20,
        paddingTop: variant === 'group' ? 24 : side && desktop ? 18 : 22,
        paddingBottom: variant === 'group' ? 8 : 6,
      }}
    >
      {children}
    </Text>
  )
}
export function ProductInset ({ children }: React.PropsWithChildren) {
  return <View style={{ marginHorizontal: 16, gap: 24 }}>{children}</View>
}

export function ProductEmpty ({ title, subtitle }: { title: string, subtitle?: string }) {
  const t = useProductTheme()
  return (
    <View style={{ paddingVertical: 72, paddingHorizontal: 40, alignItems: 'center' }}>
      <Text
        style={{
          color: t.text2,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text style={{ color: t.text3, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
          {subtitle}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  busy: { position: 'absolute', top: 8, alignSelf: 'center' },
})
