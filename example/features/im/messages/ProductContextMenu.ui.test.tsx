import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ProductContextMenu } from './ProductContextMenu'

let mockBounds = { x: 0, y: 0, width: 800, height: 600 }
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: true }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ surface: '#fff', surface2: '#eee', line: '#ddd', scrim: '#0006', text: '#111', text2: '#555', danger: '#f00', accentWeak: '#eef', shadow: 'shadow-token' }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../ui/ProductModal', () => ({ ProductModal: ({ children }: { children: React.ReactNode }) => children, useProductOverlayBounds: () => mockBounds }))

function findNode (node: any, predicate: (node: any) => boolean, parent?: any): { node: any, parent?: any } | undefined {
  if (!node || typeof node !== 'object')
    return undefined
  if (predicate(node))
    return { node, parent }
  for (const child of node.children || []) {
    const found = findNode(child, predicate, node)
    if (found)
      return found
  }
}

async function renderMenu () {
  return render(<ProductContextMenu visible position='left' pageX={40} pageY={60} bubbleWidth={120} bubbleHeight={40} items={[{ key: 'reply', label: '回复', onPress: jest.fn() }]} reactions={{ emojis: ['👍'], onSelect: jest.fn() }} onDismiss={jest.fn()} />)
}

it('uses the prototype 34px reaction button width', async () => {
  const view = await renderMenu()
  const tree = view.toJSON()
  const reaction = findNode(tree, node => node.props?.accessibilityLabel === '👍')
  expect(reaction?.node.props.style).toEqual(expect.objectContaining({ width: 34, height: 36 }))
})

it('applies the prototype shadow token to reaction and action surfaces', async () => {
  const view = await renderMenu()
  const tree = view.toJSON()
  const tray = findNode(tree, node => node.props?.style?.borderRadius === 24)
  const menu = findNode(tree, node => node.props?.style?.borderRadius === 16)

  expect(tray?.node.props.style).toEqual(expect.objectContaining({ boxShadow: 'shadow-token' }))
  expect(menu?.node.props.style).toEqual(expect.objectContaining({ boxShadow: 'shadow-token' }))
})

it('leaves the shadow visible and disables scrolling when the content fits', async () => {
  mockBounds = { x: 0, y: 0, width: 800, height: 600 }
  const view = await renderMenu()
  const menu = findNode(view.toJSON(), node => node.props?.style?.position === 'absolute' && node.props?.style?.maxHeight !== undefined)

  expect(menu?.node.props.style).toEqual(expect.objectContaining({ overflow: 'visible' }))
  expect(menu?.node.props.scrollEnabled).toBe(false)
})

it('clips and scrolls the menu when its content exceeds a short overlay', async () => {
  mockBounds = { x: 0, y: 0, width: 800, height: 120 }
  const items = Array.from({ length: 5 }, (_, index) => ({ key: `item-${index}`, label: `操作${index}`, onPress: jest.fn() }))
  const view = await render(<ProductContextMenu visible position='left' pageX={40} pageY={60} bubbleWidth={120} bubbleHeight={40} items={items} reactions={{ emojis: ['👍'], onSelect: jest.fn() }} onDismiss={jest.fn()} />)
  const menu = findNode(view.toJSON(), node => node.props?.style?.position === 'absolute' && node.props?.style?.maxHeight !== undefined)

  expect(menu?.node.props.style.maxHeight).toBe(96)
  expect(menu?.node.props.style.overflow).toBe('hidden')
  expect(menu?.node.props.scrollEnabled).toBe(true)
})
