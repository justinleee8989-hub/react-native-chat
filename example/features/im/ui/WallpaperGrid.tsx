import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ProductPressable as Pressable } from './ProductPressable'
import { useProductTheme } from './theme'

export interface WallpaperGridItem {
  key: string
  label: string
  selected: boolean
  onPress: () => void
  /** The thumbnail, filling its tile. */
  content: React.ReactNode
}

/**
 * Wallpapers as large tiles, three to a row on the page's card surface; the chosen one carries a
 * round check in its middle (聊天壁纸 and 设置颜色).
 */
export function WallpaperGrid ({ items }: { items: WallpaperGridItem[] }) {
  const t = useProductTheme()
  return (
    <View style={[styles.grid, { backgroundColor: t.surface }]}>
      {items.map(item => (
        <Pressable
          key={item.key}
          accessibilityRole='radio'
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.selected, checked: item.selected }}
          onPress={item.onPress}
          style={styles.cell}
        >
          {/* The ratio on an inner view: on Android a wrapped percentage-width item with its own
              aspectRatio collapsed to a sliver. */}
          <View style={[styles.tile, { borderColor: t.line }]}>
            {item.content}
            {item.selected && (
              <View pointerEvents='none' style={styles.checkWrap}>
                <View style={[styles.check, { backgroundColor: t.accent }]}>
                  <Text style={[styles.checkMark, { color: t.onAccent }]}>✓</Text>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, borderRadius: 16 },
  // Three columns with two 8px gaps between them.
  cell: { width: '31.5%' },
  tile: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  check: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
  checkMark: { fontSize: 22, lineHeight: 26, fontWeight: '700' },
})
