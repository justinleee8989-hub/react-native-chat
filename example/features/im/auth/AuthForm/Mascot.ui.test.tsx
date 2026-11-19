import React from 'react'
import { AccessibilityInfo, View } from 'react-native'
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import { AuthMascot } from './Mascot'

jest.mock('../../ui/preferences', () => ({ useProductScheme: () => 'light' }))
jest.mock('../../ui/ProductIcon', () => ({ ProductIcon: () => null }))

type Node = { type: string, props: Record<string, unknown>, children?: Node[] | null }

// Flushes what is already waiting (frames from before the setting was read) and says how many
// timers came back: a loop, a blink or a random move schedules its next turn.
const rescheduled = async () => {
  await act(async () => {
    jest.runOnlyPendingTimers()
  })
  return jest.getTimerCount()
}

let reduced = false
// What the test renderer itself keeps scheduled, with nothing of ours on the page.
let quiet = 0
beforeEach(async () => {
  jest.useFakeTimers()
  const blank = await render(<View />)
  quiet = await rescheduled()
  await blank.unmount()
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduced))
  // React Native's own Jest mock returns no subscription; a device does.
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never)
})
afterEach(() => {
  jest.useRealTimers()
  reduced = false
})

const mount = async (element: React.ReactElement) => {
  const view = await render(element)
  // The reduced-motion setting is read asynchronously.
  await act(async () => {})
  return view
}
// The square, then the breathing layer, the pose layer inside it, and the move layer inside that.
const layers = (view: Awaited<ReturnType<typeof render>>) => {
  const root = view.toJSON() as Node
  const breath = root.children?.[1] as Node
  const pose = breath.children?.[0] as Node
  return { root, breath, pose, move: pose.children?.[0] as Node }
}
// A value set straight (reduced motion) reaches the tree on the next render, as it does the screen.
const settle = async (view: Awaited<ReturnType<typeof render>>, element: React.ReactElement) => {
  await view.rerender(element)
  return layers(view)
}
const transformOf = (node: Node) => {
  const values: Record<string, number> = Object.assign({}, ...((node.props.style as { transform: object[] }).transform))
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.round(parseFloat(String(value)) * 100) / 100]))
}

it('holds each state\'s pose, unmoving, when the system asks for reduced motion', async () => {
  reduced = true
  const view = await mount(<AuthMascot mood='password' />)
  // Turned away from the password, shrunk.
  expect(transformOf((await settle(view, <AuthMascot mood='password' />)).pose)).toEqual({ translateX: 7, translateY: 3, rotate: 32, scaleX: 0.88, scaleY: 0.88 })
  expect(await rescheduled()).toBe(quiet)
  await view.rerender(<AuthMascot mood='error' />)
  // Slumped after a refused sign-in, and no move plays: the move layer stays at rest.
  const { pose, move } = await settle(view, <AuthMascot mood='error' />)
  expect(transformOf(pose)).toEqual({ translateX: 0, translateY: 5, rotate: -8, scaleX: 1.1, scaleY: 0.86 })
  expect(transformOf(move)).toEqual({ translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 })
  expect(await rescheduled()).toBe(quiet)
})

it('slides along under the email as it grows', async () => {
  reduced = true
  const view = await mount(<AuthMascot mood='email' typed={0} />)
  expect(transformOf((await settle(view, <AuthMascot mood='email' typed={0} />)).pose)).toMatchObject({ translateX: -4.8, rotate: -16 })
  await view.rerender(<AuthMascot mood='email' typed={26} />)
  expect(transformOf((await settle(view, <AuthMascot mood='email' typed={26} />)).pose)).toMatchObject({ translateX: 4.8, rotate: 16 })
})

it('keeps moving when left alone, and stops every timer when the page goes', async () => {
  const view = await mount(<AuthMascot />)
  // A random move and a blink each line up the next one.
  expect(await rescheduled()).toBeGreaterThan(quiet)
  await view.unmount()
  expect(await rescheduled()).toBe(quiet)
})

it('is a picture to a screen reader, on the app\'s gradient', async () => {
  const view = await mount(<AuthMascot />)
  const { root } = layers(view)
  expect(root.props.accessible).toBe(false)
  const svg = JSON.stringify(root.children?.[0])
  const id = /"name":"(mark-[^"]+)"/.exec(svg)?.[1]
  expect(id).toBeTruthy()
  expect(svg).toContain(`"brushRef":"${id}"`)
})
