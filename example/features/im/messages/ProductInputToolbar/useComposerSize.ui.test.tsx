import { Platform, StyleSheet } from 'react-native'
import { expect, it } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useComposerSize } from './useComposerSize'

it('does not collapse an existing multiline draft for a frame when its text changes', async () => {
  const platform = Platform.OS
  Platform.OS = 'web'
  const heights: number[] = []
  try {
    const view = await renderHook(({ text }: { text: string }) => {
      const size = useComposerSize({ text })
      heights.push(StyleSheet.flatten(size.style)?.height as number)
      return size
    }, { initialProps: { text: 'one\ntwo' } })
    await act(() => (view.result.current.ref as (node: unknown) => void)({ scrollHeight: 84, style: { height: '84px' } }))
    await view.rerender({ text: 'one\ntwo!' })
    await waitFor(() => expect(StyleSheet.flatten(view.result.current.style)?.height).toBe(84))
    heights.length = 0
    await view.rerender({ text: 'one\ntwo!!' })
    await waitFor(() => expect(StyleSheet.flatten(view.result.current.style)?.height).toBe(84))
    expect(heights).not.toContain(40)
  } finally {
    Platform.OS = platform
  }
})
