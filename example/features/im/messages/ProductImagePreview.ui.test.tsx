import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { ProductImagePreview } from './ProductImagePreview'

jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: false }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../ui/ProductModal', () => ({ ProductModal: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }))

function findImageNode (node: any): any {
  if (!node || typeof node !== 'object')
    return undefined
  if (node.type === 'Image')
    return node
  for (const child of node.children || []) {
    const found = findImageNode(child)
    if (found)
      return found
  }
}

function hasNestedButtons (node: any, ancestorIsButton = false): boolean {
  if (!node || typeof node !== 'object')
    return false
  const isButton = node.props?.accessibilityRole === 'button'
  if (ancestorIsButton && isButton)
    return true
  return (node.children || []).some((child: any) => hasNestedButtons(child, ancestorIsButton || isButton))
}

it('keeps preview backdrop and close button as separate controls, and backdrop closes', async () => {
  const onClose = jest.fn()
  const view = await render(<ProductImagePreview uri='https://example.com/photo.jpg' onClose={onClose} />)
  expect(hasNestedButtons(view.toJSON())).toBe(false)

  await fireEvent.press(view.getByLabelText('关闭图片预览背景'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('closes from the top-right close control', async () => {
  const onClose = jest.fn()
  const view = await render(<ProductImagePreview uri='https://example.com/photo.jpg' onClose={onClose} />)
  await fireEvent.press(view.getByLabelText('关闭图片预览'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('shows the failed-image fallback and remains closable', async () => {
  const onClose = jest.fn()
  const view = await render(<ProductImagePreview uri='https://example.com/broken.jpg' onClose={onClose} />)
  const image = findImageNode(view.toJSON())
  expect(image).toBeTruthy()
  await act(async () => image.props.onError({ nativeEvent: { error: 'load failed' } }))
  expect(view.getByText('图片暂时无法加载，请关闭后重试')).toBeTruthy()
  await fireEvent.press(view.getByLabelText('关闭图片预览'))
  expect(onClose).toHaveBeenCalledTimes(1)
})
