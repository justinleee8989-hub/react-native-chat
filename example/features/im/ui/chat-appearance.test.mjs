import assert from 'node:assert/strict'
import test from 'node:test'
import { chatThemeOf, chatThemes, parseChatTheme, sentFillStyle } from './chat-theme.ts'
import { chatWallpaperOf, chatWallpapers, chatWallpapersOf, parseChatWallpaper, resolveChatWallpaper } from './chat-wallpaper.ts'

const color = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i

test('a saved theme or wallpaper no longer offered falls back to the default', () => {
  assert.equal(parseChatTheme('ocean'), 'ocean')
  assert.equal(parseChatTheme('neon'), 'default')
  assert.equal(parseChatTheme(null), 'default')
  assert.equal(parseChatWallpaper('mint'), 'mint')
  assert.equal(parseChatWallpaper('broken'), 'plain')
  assert.equal(parseChatWallpaper(null), 'plain')
  assert.equal(chatThemeOf('gone').id, 'default')
  assert.equal(chatWallpaperOf('gone').id, 'plain')
})

test('every theme has a day and a night look in plain colors', () => {
  assert.equal(new Set(chatThemes.map(item => item.id)).size, chatThemes.length)
  for (const preset of chatThemes) {
    assert.ok(preset.corner <= preset.radius, preset.id)
    for (const look of [preset.light, preset.dark]) {
      for (const value of [look.bubble, look.text, look.meta, look.accent, look.ticks, look.link].filter(Boolean))
        assert.match(value, color, preset.id)
      // The library's swirl and window gradients take two to four stops.
      if (look.gradient)
        assert.ok(look.gradient.length >= 2 && look.gradient.length <= 4, preset.id)
    }
  }
})

test('经典 keeps the library colors: dark text on a light sent bubble by day', () => {
  const classic = chatThemeOf('classic')
  assert.equal(classic.light.gradient, null)
  assert.equal(classic.light.text, '#000000')
  assert.equal(classic.dark.text, '#FFFFFF')
})

test('a sent bubble preview draws its gradient over the plain color', () => {
  assert.deepEqual(sentFillStyle(chatThemeOf('graphite').light), { backgroundColor: '#2B2B30' })
  const style = sentFillStyle(chatThemeOf('default').light)
  assert.equal(style.backgroundColor, '#3366FF')
  assert.equal(style.experimental_backgroundImage, 'linear-gradient(to bottom, #6E6BF2, #0087F2)')
})

test('every wallpaper resolves to what it draws, in both schemes', () => {
  assert.equal(new Set(chatWallpapers.map(item => item.id)).size, chatWallpapers.length)
  for (const scheme of ['light', 'dark']) {
    assert.deepEqual(resolveChatWallpaper('plain', scheme, ''), { kind: 'plain' })
    for (const preset of chatWallpapersOf('gradient')) {
      const { kind, colors } = resolveChatWallpaper(preset.id, scheme, '')
      assert.equal(kind, 'gradient')
      assert.ok(colors.length >= 3 && colors.length <= 4, preset.id)
      colors.forEach(value => assert.match(value, color, preset.id))
    }
    for (const preset of chatWallpapersOf('color')) {
      const resolved = resolveChatWallpaper(preset.id, scheme, '')
      assert.equal(resolved.kind, 'color')
      assert.match(resolved.color, color, preset.id)
    }
  }
})

test('solid colors fill even rows of three, and differ by day and by night', () => {
  const colors = chatWallpapersOf('color')
  assert.equal(colors.length % 3, 0)
  for (const preset of colors)
    assert.notEqual(preset.light[0], preset.dark[0], preset.id)
})

test('a photo wallpaper without a saved photo draws the plain page', () => {
  assert.deepEqual(resolveChatWallpaper('photo', 'light', ''), { kind: 'plain' })
  assert.deepEqual(resolveChatWallpaper('photo', 'dark', 'file:///w.jpg'), { kind: 'photo', uri: 'file:///w.jpg' })
  // A saved photo shows only while the photo is the chosen wallpaper.
  assert.equal(resolveChatWallpaper('mint', 'light', 'file:///w.jpg').kind, 'gradient')
})
