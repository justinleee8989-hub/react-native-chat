import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  container: { borderTopWidth: 0.5 },
  actionButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emojiContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center' },
  sendPlaceholder: { width: 40, height: 40 },
  sendButton: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  emojiPanel: { maxHeight: 216, borderTopWidth: 0.5 },
  emojiButton: {
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 25 },
})
