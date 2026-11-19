import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { directory } from '../application/directory'
import { FriendPicker } from '../shared/FriendPicker'
import { ProductListRow } from './primitives'
import { productPalette as mockProductPalette } from './tokens'

let mockDesktop = false
jest.mock('./preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('./theme', () => ({ useProductTheme: () => mockProductPalette.light, useProductColors: () => ({ name: '#111', message: '#777', background: '#fff', headerBackground: '#fff', attachment: '#229af0', pressed: '#eee', draft: '#c00', divider: '#ddd' }) }))
jest.mock('./ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => ({ canGoBackInSection: false }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false, replace: jest.fn(), back: jest.fn() }) }))
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null }))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ bottom: 0 }) }))
jest.mock('../application/directory', () => ({ directory: { friends: jest.fn() } }))

function platform (value: string) {
  const previous = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value })
  return () => Object.defineProperty(Platform, 'OS', { configurable: true, value: previous })
}

function separatorStyle (instance: ReturnType<typeof screen.getByText>) {
  let parent = instance.parent
  while (parent) {
    const style = StyleSheet.flatten(parent.props.style)
    if (style?.borderBottomWidth !== undefined || style?.boxShadow !== undefined)
      return style
    parent = parent.parent
  }
  throw new Error('Expected a row separator in the rendered tree')
}

it('uses the prototype half-pixel shadow separator for web list rows', async () => {
  const restore = platform('web')
  try {
    const view = await render(<ProductListRow title='群聊 A' />)
    expect(separatorStyle(view.getByText('群聊 A'))).toMatchObject({ boxShadow: `inset 0 -0.5px 0 ${mockProductPalette.light.line}` })
  } finally {
    restore()
  }
})

it('keeps a native hairline separator for list rows', async () => {
  const restore = platform('ios')
  try {
    const view = await render(<ProductListRow title='群聊 A' />)
    expect(separatorStyle(view.getByText('群聊 A'))).toMatchObject({ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: mockProductPalette.light.line })
  } finally {
    restore()
  }
})

it('uses the prototype half-pixel shadow separator for web friend rows', async () => {
  jest.mocked(directory.friends).mockResolvedValue([{ userID: 'alice', nickname: 'Alice' }, { userID: 'bob', nickname: 'Bob' }])
  const restore = platform('web')
  try {
    await render(<FriendPicker selected={[]} onChange={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(separatorStyle(screen.getByText('Alice'))).toMatchObject({ boxShadow: `inset 0 -0.5px 0 ${mockProductPalette.light.line}` })
  } finally {
    restore()
  }
})

it('keeps a native hairline separator for friend rows', async () => {
  jest.mocked(directory.friends).mockResolvedValue([{ userID: 'alice', nickname: 'Alice' }, { userID: 'bob', nickname: 'Bob' }])
  const restore = platform('ios')
  try {
    await render(<FriendPicker selected={[]} onChange={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
    expect(separatorStyle(screen.getByText('Alice'))).toMatchObject({ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: mockProductPalette.light.line })
  } finally {
    restore()
  }
})
