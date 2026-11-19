import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { AuthPage } from './AuthForm'

let mockDesktop = true
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ page: '#fff', bg: '#fff', text: '#111', text3: '#777' }), useProductColors: () => ({ name: '#111', message: '#777' }) }))
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null }))
jest.mock('../ui/primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { ProductHeader: ({ detail }: { detail?: boolean }) => React.createElement(View, { testID: 'auth-header', accessibilityLabel: String(detail) }) }
})
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }))

it('marks the desktop auth back header as a detail header', async () => {
  const previous = mockDesktop
  mockDesktop = true
  try {
    const view = await render(<AuthPage brand={false} title='创建账户' subtitle='创建账户说明' onBack={jest.fn()} />)
    expect(view.getByTestId('auth-header').props.accessibilityLabel).toBe('true')
  } finally {
    mockDesktop = previous
  }
})

it('hides the auth scroll indicator so desktop forms stay centered at the prototype width', async () => {
  const view = await render(<AuthPage brand={false} title='创建账户' subtitle='创建账户说明' />)
  let scroll = view.getByText('创建账户').parent
  while (scroll && scroll.props.keyboardShouldPersistTaps !== 'handled')
    scroll = scroll.parent
  expect(scroll?.props.showsVerticalScrollIndicator).toBe(false)
})
