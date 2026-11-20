import React from 'react'
import { View } from 'react-native'
import { afterEach, expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import { ProductToast, showProductToast } from './ProductToast'

jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: false }), useProductScheme: () => 'light' }))

jest.useFakeTimers()
afterEach(async () => {
  // Let the last toast run out, so the next test starts with none.
  await act(() => jest.runOnlyPendingTimers())
})

function Screen ({ call }: { call: boolean }) {
  return (
    <View>
      <View testID='page'><ProductToast /></View>
      {call && <View testID='call'><ProductToast modal /></View>}
    </View>
  )
}

it('shows the toast once, in the modal, while a modal host is up, and on the page after it closes', async () => {
  const view = await render(<Screen call />)
  await act(() => showProductToast('无法连接通话服务'))
  expect(view.getAllByText('无法连接通话服务')).toHaveLength(1)
  expect(view.getByTestId('call')).toContainElement(view.getByText('无法连接通话服务'))

  await view.rerender(<Screen call={false} />)
  expect(view.getAllByText('无法连接通话服务')).toHaveLength(1)
  expect(view.getByTestId('page')).toContainElement(view.getByText('无法连接通话服务'))

  await act(() => jest.advanceTimersByTime(1900))
  expect(view.queryByText('无法连接通话服务')).toBeNull()
})

it('shows it on every page host when no modal host is up, as before', async () => {
  const view = await render(<Screen call={false} />)
  await act(() => showProductToast('已发送'))
  expect(view.getAllByText('已发送')).toHaveLength(1)
})
