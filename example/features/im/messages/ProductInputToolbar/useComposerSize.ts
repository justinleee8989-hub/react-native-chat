import type { Ref } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import type { ComposerInputNode, ComposerSize, ProductInputToolbarProps } from './types'

export function useComposerSize ({ text, textInputProps }: ProductInputToolbarProps): ComposerSize {
  const [composerHeight, setComposerHeight] = useState(40)
  const [inputWidth, setInputWidth] = useState<number>()
  const inputNodeRef = useRef<ComposerInputNode | null>(null)
  const textInputRef = (textInputProps as { ref?: Ref<unknown> } | undefined)?.ref
  const resizeComposer = useCallback((height: number) => {
    setComposerHeight(Math.max(40, Math.min(118, Math.ceil(height))))
  }, [])
  const measureWebComposer = useCallback(() => {
    if (Platform.OS !== 'web')
      return
    const input = inputNodeRef.current?.getNativeRef?.() ?? inputNodeRef.current
    // Measure the natural height before paint, without committing an intermediate single-line layout.
    const previousHeight = input?.style?.height
    if (input?.style)
      input.style.height = '0px'
    const height = input?.scrollHeight
    if (input?.style && previousHeight !== undefined)
      input.style.height = previousHeight
    if (typeof height === 'number' && height > 0)
      resizeComposer(height)
  }, [resizeComposer])
  const attachInputRef = useCallback(
    (input: unknown) => {
      inputNodeRef.current = input as typeof inputNodeRef.current
      if (typeof textInputRef === 'function')
        textInputRef(input)
      else if (textInputRef && typeof textInputRef === 'object')
        (textInputRef as { current: unknown }).current = input
    },
    [textInputRef]
  )
  useLayoutEffect(() => {
    measureWebComposer()
  }, [text, inputWidth, measureWebComposer])

  return {
    ref: attachInputRef,
    style: [textInputProps?.style, { height: composerHeight }],
    onLayout: event => {
      textInputProps?.onLayout?.(event)
      const width = event.nativeEvent.layout.width
      setInputWidth(current => (current === width ? current : width))
    },
    onContentSizeChange: event => {
      textInputProps?.onContentSizeChange?.(event)
      if (Platform.OS !== 'web')
        resizeComposer(event.nativeEvent.contentSize.height)
    },
  }
}
