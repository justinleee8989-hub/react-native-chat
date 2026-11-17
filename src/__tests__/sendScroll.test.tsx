import { act, renderHook } from '@testing-library/react-native'
import { useSendScroll } from '../Chat/useSendScroll'

const message = (_id: string, userID = 'self') => ({ _id, user: { _id: userID }, text: _id, createdAt: new Date() })

it('waits for an outgoing row, then delegates one nonanimated end alignment to the list', async () => {
  const scrollToEnd = jest.fn()
  const ref = { current: { scrollToEnd } } as any
  const view = await renderHook(({ messages }) => useSendScroll(messages, 'self', ref), { initialProps: { messages: [message('old')] } })
  await act(() => view.result.current())
  expect(scrollToEnd).not.toHaveBeenCalled()
  await view.rerender({ messages: [message('incoming', 'peer'), message('old')] })
  expect(scrollToEnd).not.toHaveBeenCalled()
  await view.rerender({ messages: [message('new'), message('old')] })
  expect(scrollToEnd).toHaveBeenCalledTimes(1)
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
  await view.rerender({ messages: [message('new'), message('old')] })
  expect(scrollToEnd).toHaveBeenCalledTimes(1)
})

it.each([true, false])('follows the end of a batch without depending on measured rows or array order (%s)', async newestFirst => {
  const scrollToEnd = jest.fn()
  const ref = { current: { scrollToEnd } } as any
  const view = await renderHook(({ messages }) => useSendScroll(messages, 'self', ref), { initialProps: { messages: [message('old')] } })
  await act(() => view.result.current())
  const messages = [message('old'), message('new-1'), message('new-2')]
  await view.rerender({ messages: newestFirst ? messages.reverse() : messages })
  expect(scrollToEnd).toHaveBeenCalledTimes(1)
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
})
