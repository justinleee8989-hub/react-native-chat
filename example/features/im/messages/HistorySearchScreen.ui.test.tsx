import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import HistorySearchScreen from './HistorySearchScreen'
const mockPush = jest.fn()
const mockSearch = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: { userID: 'self', imToken: 'token' }, conversations: [] }), loadServerHistory: (...args: unknown[]) => mockSearch(...args) }))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), dismissTo: mockPush, back: jest.fn(), canGoBack: () => true }) }))
jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: false }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ accent: '#3366ff', danger: '#e5484d', line: '#ddd', text: '#111', text2: '#555', text3: '#777', bg: '#fff' }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
it('shows search result rows and navigates to the exact message', async () => {
  mockSearch.mockResolvedValue({ messages: [{ clientMsgID: 'm1', sendID: 'p1', senderNickname: '小林', textElem: { content: '会议安排' }, sendTime: 1000, status: 2, contentType: 101 }], hasMore: false, cursor: '' })
  const view = await render(<HistorySearchScreen id='c1' />)
  await fireEvent.changeText(view.getByLabelText('输入关键词'), ' 会议 ')
  await fireEvent(view.getByLabelText('输入关键词'), 'submitEditing')
  await waitFor(() => expect(view.getByText('小林')).toBeTruthy())
  expect(mockSearch).toHaveBeenCalledWith({ conversationID: 'c1', query: '会议', cursor: '' })
  await fireEvent.press(view.getByLabelText('查看消息：会议安排'))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/chats/[id]', params: { id: 'c1', messageID: 'm1' } })
})

it('highlights matching search text with the prototype danger color', async () => {
  mockSearch.mockResolvedValue({ messages: [{ clientMsgID: 'match', sendID: 'p1', senderNickname: '小林', textElem: { content: '会议安排' }, sendTime: 1000, status: 2, contentType: 101 }], hasMore: false, cursor: '' })
  const view = await render(<HistorySearchScreen id='c1' />)
  await fireEvent.changeText(view.getByLabelText('输入关键词'), '会议')
  await fireEvent(view.getByLabelText('输入关键词'), 'submitEditing')
  await waitFor(() => expect(view.getByText('会议')).toBeTruthy())

  expect(view.getByText('会议').props.style).toEqual(expect.objectContaining({ color: '#e5484d' }))
})

it('automatically searches a changed query without submitting', async () => {
  mockSearch.mockResolvedValue({ messages: [], hasMore: false, cursor: '' })
  const view = await render(<HistorySearchScreen id='c1' />)
  await fireEvent.changeText(view.getByLabelText('输入关键词'), '自动搜索')
  await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ conversationID: 'c1', query: '自动搜索', cursor: '' }))
})

it('ignores an older response after a query edit and keeps server pagination', async () => {
  let oldResolve!: (value: unknown) => void
  mockSearch.mockImplementationOnce(() => new Promise(resolve => {
    oldResolve = resolve
  }))
    .mockResolvedValueOnce({ messages: [{ clientMsgID: 'new', sendID: 'p', textElem: { content: 'new result' }, sendTime: 2000, status: 2, contentType: 101 }], hasMore: true, cursor: 'next-page' })
    .mockResolvedValueOnce({ messages: [{ clientMsgID: 'page2', sendID: 'p', textElem: { content: 'new older' }, sendTime: 1000, status: 2, contentType: 101 }], hasMore: false, cursor: '' })
  const view = await render(<HistorySearchScreen id='c1' />)
  const input = view.getByLabelText('输入关键词')
  await fireEvent.changeText(input, 'old')
  await fireEvent(input, 'submitEditing')
  await fireEvent.changeText(input, 'new')
  await fireEvent(input, 'submitEditing')
  await waitFor(() => expect(view.getByLabelText('查看消息：new result')).toBeTruthy())
  await act(async () => oldResolve({ messages: [{ clientMsgID: 'old', sendID: 'p', textElem: { content: 'old result' }, sendTime: 3000 }], hasMore: false, cursor: '' }))
  expect(view.queryByLabelText('查看消息：old result')).toBeNull()
  await fireEvent.press(view.getByText('继续搜索更早记录'))
  await waitFor(() => expect(view.getByLabelText('查看消息：new older')).toBeTruthy())
  expect(mockSearch).toHaveBeenLastCalledWith({ conversationID: 'c1', query: 'new', cursor: 'next-page' })
  expect(view.getByLabelText('查看消息：new result')).toBeTruthy()
})
it('shows server failures and allows retry of the same query', async () => {
  mockSearch.mockRejectedValueOnce(new Error('服务暂不可用')).mockResolvedValueOnce({ messages: [], hasMore: false, cursor: '' })
  const view = await render(<HistorySearchScreen id='c1' />)
  await fireEvent.changeText(view.getByLabelText('输入关键词'), 'query')
  await fireEvent(view.getByLabelText('输入关键词'), 'submitEditing')
  await waitFor(() => expect(view.getByText('服务暂不可用')).toBeTruthy())
  await fireEvent.press(view.getByText('重试搜索'))
  await waitFor(() => expect(view.getByText('未找到匹配消息')).toBeTruthy())
})
