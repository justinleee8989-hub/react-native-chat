import { StyleSheet } from 'react-native'
import { productMetrics } from '../../ui/tokens'

export const styles = StyleSheet.create({
  hidden: { display: 'none' },
  mobile: { flex: 1, width: '100%' },
  stage: { flex: 1 },
  stageDesktop: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, width: '100%' },
  frameDesktop: {
    maxWidth: productMetrics.frameWidth,
    maxHeight: productMetrics.frameHeight,
    borderRadius: 18,
    overflow: 'hidden',
  },
  columns: { flex: 1, flexDirection: 'row' },
  rail: {
    flex: 1,
    width: 72,
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 14,
    gap: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  railButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 5,
    fontSize: 10.5,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  master: { width: 340, borderRightWidth: StyleSheet.hairlineWidth },
  detail: { flex: 1, minWidth: 0 },
  blank: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
})
