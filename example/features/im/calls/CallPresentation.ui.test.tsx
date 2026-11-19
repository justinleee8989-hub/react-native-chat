import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { translatorFor } from '../i18n/translate'
import { CallControl, CallPresentation, callConnectionLabel } from './CallPresentation'

const zhT = translatorFor('zh')
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: true }) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../ui/primitives', () => {
  const Native = require('react-native')
  return { ProductAvatar: (props: { group?: boolean }) => <Native.View testID='call-avatar' group={props.group} /> }
})
jest.mock('react-native-svg', () => {
  const Native = require('react-native')
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <Native.View>{children}</Native.View>,
    Defs: ({ children }: { children: React.ReactNode }) => <Native.View>{children}</Native.View>,
    RadialGradient: (props: Record<string, unknown>) => <Native.View testID='call-radial-gradient' {...props} />,
    Rect: () => <Native.View />,
    Stop: () => <Native.View />,
  }
})
it('keeps unavailable media controls disabled before connection', async () => {
  const toggle = jest.fn()
  const view = await render(<CallPresentation name='真实联系人' id='peer' status='正在呼叫…'><CallControl label='已静音' icon='micOff' disabled onPress={toggle} /></CallPresentation>)
  await fireEvent.press(view.getByLabelText('已静音'))
  expect(toggle).not.toHaveBeenCalled()
  expect(view.getByText('正在呼叫…')).toBeTruthy()
  expect(view.getByTestId('call-presentation').props.style.width).toBe(360)
})
it('routes incoming accept and reject controls separately', async () => {
  const accept = jest.fn(), reject = jest.fn()
  const view = await render(<CallPresentation name='真实联系人' id='peer' status='邀请你进行音视频通话'><CallControl label='接听' icon='phone' tone='green' onPress={accept} /><CallControl label='拒接' icon='phone' tone='red' onPress={reject} /></CallPresentation>)
  await fireEvent.press(view.getByLabelText('接听'))
  expect(accept).toHaveBeenCalledTimes(1)
  expect(reject).not.toHaveBeenCalled()
})

it('matches the call gradient and avoids a desktop-wide scrim', async () => {
  const view = await render(<CallPresentation name='真实联系人' id='peer' status='正在呼叫…' />)
  const root = view.toJSON() as any
  expect(root.props.style.backgroundColor).not.toBe('#0008')
  expect(view.getByTestId('call-radial-gradient').props).toEqual(expect.objectContaining({
    cx: 0,
    cy: 0,
    r: 1,
    gradientUnits: 'objectBoundingBox',
    gradientTransform: 'matrix(1.2 0 0 0.8 0.5 0)',
  }))
})

it('uses the group avatar shape for group calls', async () => {
  const view = await render(<CallPresentation {...{ group: true } as any} name='QA 群' id='group-1' status='正在呼叫…' />)
  expect(view.getByTestId('call-avatar').props.group).toBe(true)
})

it.each([
  ['connected', '已连接'],
  ['connecting', '正在连接…'],
  ['reconnecting', '正在重连'],
  ['signalReconnecting', '正在重连'],
  ['disconnected', '连接已断开'],
  ['unknown', '准备连接'],
] as const)('maps the %s connection state to its user-facing label', (state, label) => {
  expect(zhT(callConnectionLabel(state))).toBe(label)
})

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
