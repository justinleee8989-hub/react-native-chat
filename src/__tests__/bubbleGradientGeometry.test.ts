import { gradientGeometry } from '../components/bubbleGradientGeometry'

it('keeps list gradients unchanged without a window frame', () => {
  expect(gradientGeometry(600, 240)).toEqual({ height: 600, translateY: 360, fraction: 0.4 })
})

it('includes navigation and composer space in window gradients', () => {
  expect(gradientGeometry(600, 240, { top: 80, height: 800 })).toEqual({ height: 800, translateY: 480, fraction: 0.4 })
})

it('moves the sampled slice continuously with scrolling', () => {
  const before = gradientGeometry(600, 320, { top: 80, height: 800 })
  const after = gradientGeometry(600, 240, { top: 80, height: 800 })
  expect(after.translateY - before.translateY).toBe(80)
  expect(before.fraction - after.fraction).toBeCloseTo(0.1)
})

it('uses the latest frame after resizing and clamps tail samples', () => {
  expect(gradientGeometry(300, 200, { top: 50, height: 500 }).fraction).toBe(0.5)
  expect(gradientGeometry(300, -100, { top: 50, height: 500 }).fraction).toBe(0)
  expect(gradientGeometry(300, 600, { top: 50, height: 500 }).fraction).toBe(1)
})

it('falls back safely before the window has been measured', () => {
  expect(gradientGeometry(600, 240, { top: 0, height: 0 })).toEqual(gradientGeometry(600, 240))
  expect(gradientGeometry(0, 0).height).toBeGreaterThan(0)
})
