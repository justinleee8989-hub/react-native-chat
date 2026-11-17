export interface GradientWindowFrame {
  top: number
  height: number
}

/** Maps a list-local bubble edge into a shared gradient, independent of message data. */
export function gradientGeometry (listHeight: number, bottom: number, frame?: GradientWindowFrame) {
  'worklet'
  const hasFrame = !!frame && frame.height > 0
  const height = hasFrame ? frame.height : Math.max(1, listHeight)
  const edge = bottom + (hasFrame ? frame.top : 0)
  return {
    height,
    translateY: height - edge,
    fraction: Math.min(1, Math.max(0, edge / height)),
  }
}
