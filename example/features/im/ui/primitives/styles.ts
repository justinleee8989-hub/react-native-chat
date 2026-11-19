import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  largeHeader: { paddingLeft: 20, paddingTop: 10, paddingBottom: 8, minHeight: 66 },
  centeredHeading: { position: 'absolute', left: 92, right: 92 },
  // Header padding (6) and the back button (44), with a little air.
  centeredHeadingNarrow: { left: 56, right: 56 },
  heading: { flex: 1, minWidth: 0 },
  // A section's own title (消息, 通讯录, 通话, 我的), the same on a phone and on PC: PC drew it at
  // 24/700, so the same page looked like a different product on the two.
  pageTitle: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  detailTitle: { fontSize: 17, lineHeight: 22, fontWeight: '500' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  search: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, height: '100%' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 3,
    borderRadius: 12,
  },
  segmentItem: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
