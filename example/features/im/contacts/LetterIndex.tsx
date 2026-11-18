import React, { useLayoutEffect, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, View } from 'react-native'
import { useProductTheme } from '../ui/theme'

const ROW = 16
const PAD = 4

/** The letter under a finger `offset` px below the first of `letters`, clamped to the bar. */
export function letterAt (offset: number, letters: string[]) {
  return letters[Math.max(0, Math.min(letters.length - 1, Math.floor(offset / ROW)))]
}

/**
 * The A–Z column at the right of the contacts list: tap or drag along it to jump to a letter, with
 * the letter shown large in the middle of the list while the finger is down (as phone contact apps
 * do). Rendered over the list (`ProductPage`'s `overlay`), so it does not scroll with it.
 */
export function LetterIndex ({ letters, onSelect }: { letters: string[], onSelect: (letter: string) => void }) {
  const t = useProductTheme()
  const [active, setActive] = useState<string>()
  const bar = useRef<React.ComponentRef<typeof View>>(null)
  const top = useRef(0)
  const current = useRef<string | undefined>(undefined)
  // Set in a layout effect so the responder, created once, always reads the current letters.
  const pick = useRef<(pageY: number) => void>(() => {})
  useLayoutEffect(() => {
    pick.current = (pageY: number) => {
      const letter = letterAt(pageY - top.current - PAD, letters)
      if (!letter || letter === current.current)
        return
      current.current = letter
      setActive(letter)
      onSelect(letter)
    }
  })
  const measure = () => bar.current?.measureInWindow((_x, y) => {
    top.current = y
  })
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // The list must not take the drag over: the finger is choosing letters, not scrolling.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event => pick.current(event.nativeEvent.pageY),
    onPanResponderMove: event => pick.current(event.nativeEvent.pageY),
    onPanResponderRelease: () => {
      current.current = undefined
      setActive(undefined)
    },
    onPanResponderTerminate: () => {
      current.current = undefined
      setActive(undefined)
    },
  }))
  const step = (by: number) => {
    const index = Math.max(0, Math.min(letters.length - 1, letters.indexOf(active ?? letters[0]) + by))
    setActive(letters[index])
    onSelect(letters[index])
  }
  return (
    <>
      {active && (
        <View pointerEvents='none' style={styles.bubbleWrap}>
          <View style={[styles.bubble, { backgroundColor: t.surface2 }]}>
            <Text style={[styles.bubbleText, { color: t.text }]}>{active}</Text>
          </View>
        </View>
      )}
      <View pointerEvents='box-none' style={styles.column}>
        <View
          ref={bar}
          onLayout={measure}
          accessible
          accessibilityRole='adjustable'
          accessibilityLabel='按字母定位'
          accessibilityValue={{ text: active ?? letters[0] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          {...responder.panHandlers}
          style={styles.bar}
        >
          {letters.map(letter => (
            <Text
              key={letter}
              pointerEvents='none'
              style={[styles.letter, { color: letter === active ? t.accent : t.text2 }]}
            >
              {letter}
            </Text>
          ))}
        </View>
      </View>
    </>
  )
}

/** The small letter heading above each group of friends. */
export function LetterHeader ({ letter, side, onLayout }: {
  letter: string
  side: boolean
  onLayout: (y: number) => void
}) {
  const t = useProductTheme()
  return (
    <Text
      onLayout={event => onLayout(event.nativeEvent.layout.y)}
      style={[styles.header, { color: t.text3, paddingHorizontal: side ? 18 : 20 }]}
    >
      {letter}
    </Text>
  )
}

const styles = StyleSheet.create({
  column: { position: 'absolute', top: 0, bottom: 0, right: 2, justifyContent: 'center' },
  bar: { paddingVertical: PAD, paddingHorizontal: 4 },
  letter: { height: ROW, width: 16, fontSize: 11, lineHeight: ROW, fontWeight: '600', textAlign: 'center' },
  bubbleWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontSize: 30, fontWeight: '600' },
  header: { fontSize: 13, lineHeight: 18, paddingTop: 10, paddingBottom: 4 },
})
