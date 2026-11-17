import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { HistoryLoadIndicator } from './HistoryLoadIndicator'

jest.mock('@kesha-antonov/react-native-chat', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return { LoadEarlierMessages: () => <Text>分页加载中</Text> }
})

it('shows paging progress only for a real earlier-history request', async () => {
  const props = { isAvailable: true, isLoading: true, isInfiniteScrollEnabled: true, onPress: () => {} }
  const view = await render(<HistoryLoadIndicator {...props} paging={false} />)
  expect(view.queryByText('分页加载中')).toBeNull()
  await view.rerender(<HistoryLoadIndicator {...props} paging />)
  expect(view.getByText('分页加载中')).toBeTruthy()
  await view.rerender(<HistoryLoadIndicator {...props} isLoading={false} paging />)
  expect(view.queryByText('分页加载中')).toBeNull()
})
