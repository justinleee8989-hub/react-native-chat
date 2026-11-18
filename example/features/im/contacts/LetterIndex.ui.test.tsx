import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { LetterIndex, letterAt } from './LetterIndex'

jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ accent: '#36f', text: '#111', text2: '#555', surface2: '#eee' }) }))

it('maps a finger position to the letter under it, clamped to the bar', () => {
  const letters = ['A', 'B', 'C']
  expect(letterAt(0, letters)).toBe('A')
  expect(letterAt(17, letters)).toBe('B')
  expect(letterAt(500, letters)).toBe('C')
  expect(letterAt(-20, letters)).toBe('A')
})

it('lets a screen reader step through the letters', async () => {
  const select = jest.fn()
  await render(<LetterIndex letters={['A', 'B', 'C']} onSelect={select} />)
  const bar = screen.getByLabelText('按字母定位')
  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
  expect(select).toHaveBeenLastCalledWith('B')
  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
  expect(select).toHaveBeenLastCalledWith('C')
  await fireEvent(bar, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
  expect(select).toHaveBeenLastCalledWith('B')
})
