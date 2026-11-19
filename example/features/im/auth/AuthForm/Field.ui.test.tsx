import React from 'react'
import { StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { productPalette } from '../../ui/tokens'
import { AuthNotice } from './Controls'
import { AuthField } from './Field'

jest.mock('../../ui/preferences', () => ({ useLanguageChoice: () => 'zh', useProductLayout: () => ({ desktop: false }), useProductScheme: () => 'dark' }))
jest.mock('../../ui/ProductIcon', () => ({ ProductIcon: () => null }))

const t = productPalette.dark
const styleOf = (node: { props: { style?: unknown } } | null) => StyleSheet.flatten(node?.props.style as never) ?? {}
// The input sits right in the row that is edged, filled and ringed.
const rowOf = (view: Awaited<ReturnType<typeof render>>, label: string) => styleOf(view.getByLabelText(label).parent)

it('edges a refused field in red, and lifts it onto the page with the accent ring while it has the focus', async () => {
  const view = await render(<AuthField label='密码' invalid value='wrong' onChangeText={jest.fn()} />)
  expect(rowOf(view, '密码')).toMatchObject({ borderColor: t.danger, backgroundColor: t.surface2 })
  expect(rowOf(view, '密码').boxShadow).toBeUndefined()
  await fireEvent(view.getByLabelText('密码'), 'focus')
  expect(rowOf(view, '密码')).toMatchObject({ borderColor: t.accent, backgroundColor: t.page, boxShadow: `0 0 0 4px ${t.accentWeak}` })
  await fireEvent(view.getByLabelText('密码'), 'blur')
  expect(rowOf(view, '密码').borderColor).toBe(t.danger)
})

it('has no edge on a field that was not refused', async () => {
  const view = await render(<AuthField label='邮箱账号' value='' onChangeText={jest.fn()} />)
  expect(rowOf(view, '邮箱账号').borderColor).toBe('transparent')
})

it('tells the page when the password is shown or hidden again', async () => {
  const reveal = jest.fn()
  const view = await render(<AuthField label='密码' password reveal onRevealChange={reveal} value='secret' onChangeText={jest.fn()} />)
  expect(view.getByLabelText('密码').props.secureTextEntry).toBe(true)
  await fireEvent.press(view.getByRole('button', { name: '显示密码' }))
  expect(reveal).toHaveBeenLastCalledWith(true)
  expect(view.getByLabelText('密码').props.secureTextEntry).toBe(false)
  await fireEvent.press(view.getByRole('button', { name: '隐藏密码' }))
  expect(reveal).toHaveBeenLastCalledWith(false)
})

it('puts an error on a pale red card whose mark a screen reader skips', async () => {
  const view = await render(<AuthNotice error>账号或密码错误</AuthNotice>)
  const text = view.getByRole('alert')
  expect(text.props.children).toBe('账号或密码错误')
  expect(styleOf(text).color).toBe(t.danger)
  expect(styleOf(text.parent).backgroundColor).toBe(t.dangerWeak)
  // Out of the accessibility tree, so out of reach of queries that only see what is read aloud.
  expect(view.queryByText('!')).toBeNull()
  const mark = view.getByText('!', { includeHiddenElements: true }).parent
  expect(mark?.props.importantForAccessibility).toBe('no-hide-descendants')
  expect(styleOf(mark).backgroundColor).toBe(t.danger)
})

it('keeps a plain notice a line of text, without the card', async () => {
  const view = await render(<AuthNotice>验证码已发送</AuthNotice>)
  expect(view.queryByRole('alert')).toBeNull()
  expect(view.queryByText('!')).toBeNull()
  expect(styleOf(view.getByText('验证码已发送')).color).toBe(t.accent)
})
