import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useProductTheme } from './theme'

export type ProductSkeletonKind = 'list' | 'profile' | 'settings' | 'members'

/**
 * Structural placeholders only: no fabricated names, counts or actionable controls.
 *
 * Each kind is drawn to the measurements of the page it stands in for (list rows, grouped cards,
 * the profile header), so the content that replaces it lands where the placeholder was. A
 * placeholder of a different shape made the whole page jump when the data arrived.
 */
export function ProductSkeleton ({ kind = 'list', rows, small = false, group = false }: {
  kind?: ProductSkeletonKind
  /** List rows to draw; defaults fill about a screen. */
  rows?: number
  /** Matches `ProductListRow small` (64px rows instead of 72px). */
  small?: boolean
  /** A group's profile: its avatar is a rounded square, a person's is a circle. */
  group?: boolean
}) {
  return (
    <View accessible accessibilityLabel='正在加载内容' accessibilityState={{ busy: true }} pointerEvents='none'>
      <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
        {kind === 'list' && <ListRows count={rows ?? 7} small={small} />}
        {kind === 'profile' && (
          <>
            <ProfileHeader group={group} />
            <Group rows={1} />
            <Group rows={3} />
          </>
        )}
        {kind === 'members' && <MemberCard count={rows ?? 8} />}
        {kind === 'settings' && (
          <>
            <Group rows={2} />
            <Group rows={3} />
          </>
        )}
      </View>
    </View>
  )
}

function ListRows ({ count, small }: { count: number, small: boolean }) {
  const t = useProductTheme()
  const fill = { backgroundColor: t.surface2 }
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.listRow, { minHeight: small ? 64 : 72 }]}>
          <View style={[styles.avatar, fill]} />
          <View style={styles.copy}>
            <View style={[styles.title, fill, { width: index % 2 ? '42%' : '58%' }]} />
            <View style={[styles.detail, fill, { width: index % 2 ? '66%' : '80%' }]} />
          </View>
        </View>
      ))}
    </>
  )
}

/** A `ProductSection` title over a `ProductInset` card of `ProductRow`s. */
function Group ({ rows }: { rows: number }) {
  const t = useProductTheme()
  const fill = { backgroundColor: t.surface2 }
  return (
    <>
      <View style={styles.section}>
        <View style={[styles.sectionTitle, fill]} />
      </View>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={[styles.cardRow, index > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.title, fill, { width: index % 2 ? '28%' : '36%' }]} />
            <View style={[styles.trailing, fill]} />
          </View>
        ))}
      </View>
    </>
  )
}

/** One `ProductInset` card of member rows (`MemberRow`: 40px avatar). */
function MemberCard ({ count }: { count: number }) {
  const t = useProductTheme()
  const fill = { backgroundColor: t.surface2 }
  return (
    <View style={[styles.card, styles.memberCard, { backgroundColor: t.surface }]}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.cardRow, styles.memberRow, index > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[styles.memberAvatar, fill]} />
          <View style={[styles.title, fill, { flex: 0, width: index % 2 ? '30%' : '42%' }]} />
        </View>
      ))}
    </View>
  )
}

/** The centred avatar, name and summary at the top of a person or group page. */
function ProfileHeader ({ group }: { group: boolean }) {
  const t = useProductTheme()
  const fill = { backgroundColor: t.surface2 }
  return (
    <View style={styles.hero}>
      {/* ProductAvatar: a circle, or 0.3 of the size for a group. */}
      <View style={[styles.heroAvatar, fill, { borderRadius: group ? 29 : 48 }]} />
      <View style={[styles.heroName, fill]} />
      <View style={[styles.heroDetail, fill]} />
    </View>
  )
}

const styles = StyleSheet.create({
  // ProductListRow: 20px sides, 44px avatar, 12px gap.
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  avatar: { width: 44, height: 44, borderRadius: 14 },
  copy: { flex: 1, gap: 10 },
  title: { height: 14, borderRadius: 5 },
  detail: { height: 10, borderRadius: 4 },
  // ProductSection (group variant) and ProductInset + ProductCard + ProductRow.
  section: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 8, height: 50, justifyContent: 'center' },
  sectionTitle: { height: 12, width: 64, borderRadius: 4 },
  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  cardRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  trailing: { height: 12, width: 72, borderRadius: 4 },
  memberCard: { marginTop: 12 },
  memberRow: { justifyContent: 'flex-start', gap: 12 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  // Person and group pages: 96px avatar, 30px name 12px below it, 20px summary.
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 4, paddingHorizontal: 24, gap: 4 },
  heroAvatar: { height: 96, width: 96 },
  heroName: { height: 22, width: 140, borderRadius: 6, marginTop: 16, marginBottom: 4 },
  heroDetail: { height: 14, width: 120, borderRadius: 4, marginVertical: 3 },
})
