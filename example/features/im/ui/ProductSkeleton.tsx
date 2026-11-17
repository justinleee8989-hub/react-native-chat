import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useProductTheme } from './theme'

export type ProductSkeletonKind = 'list' | 'profile' | 'settings'

/** Structural placeholders only: no fabricated names, counts or actionable controls. */
export function ProductSkeleton ({ kind = 'list' }: { kind?: ProductSkeletonKind }) {
  const t = useProductTheme()
  const fill = { backgroundColor: t.surface2 }
  return (
    <View accessible accessibilityLabel='正在加载内容' accessibilityState={{ busy: true }} pointerEvents='none' style={styles.root}>
      <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
        {kind === 'profile' && (
          <View style={styles.hero}>
            <View style={[styles.heroAvatar, fill]} />
            <View style={[styles.heroName, fill]} />
            <View style={[styles.heroDetail, fill]} />
          </View>
        )}
        {Array.from({ length: kind === 'profile' ? 4 : 7 }, (_, index) => (
          <View key={index} style={[styles.row, { borderBottomColor: t.line }]}>
            {kind === 'list' && <View style={[styles.avatar, fill]} />}
            <View style={styles.copy}>
              <View style={[styles.title, fill, { width: index % 2 ? '42%' : '58%' }]} />
              <View style={[styles.detail, fill, { width: index % 2 ? '66%' : '80%' }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 8 },
  row: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: 14 },
  copy: { flex: 1, gap: 10 },
  title: { height: 14, borderRadius: 5 },
  detail: { height: 10, borderRadius: 4 },
  hero: { alignItems: 'center', paddingVertical: 28, gap: 14 },
  heroAvatar: { height: 80, width: 80, borderRadius: 24 },
  heroName: { height: 18, width: 128, borderRadius: 5 },
  heroDetail: { height: 12, width: 164, borderRadius: 4 },
})
