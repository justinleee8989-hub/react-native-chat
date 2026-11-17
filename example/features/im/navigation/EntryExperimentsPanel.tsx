import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { cycleEntryExperiment, type EntryExperiments, useEntryExperiments } from './entry-experiments'
import { entryTraceEnabled } from './entry-performance'

const ROWS: { key: keyof EntryExperiments, label: string }[] = [
  { key: 'entryMode', label: '进入' },
  { key: 'activity', label: 'Activity' },
  { key: 'bufferExpand', label: '缓冲' },
  { key: 'animation', label: '动画' },
  { key: 'firstBuffer', label: '首屏' },
]

/**
 * Diagnostic Release only (EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1): switches the chat-entry experiments
 * at runtime, so one build can compare them. Each tap moves that experiment to its next choice.
 */
export function EntryExperimentsPanel () {
  const experiments = useEntryExperiments()
  if (!entryTraceEnabled)
    return null
  return (
    <View style={styles.panel} pointerEvents='box-none'>
      {ROWS.map(row => (
        <Pressable
          key={row.key}
          accessibilityRole='button'
          onPress={() => cycleEntryExperiment(row.key)}
          style={styles.button}
        >
          <Text style={styles.text}>{row.label}: {experiments[row.key]}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    gap: 6,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})
