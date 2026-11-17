type StateSubscription = { remove: () => void }
type NativeAppState = {
  currentState?: string | null
  addEventListener: (event: 'change', listener: (state: string) => void) => StateSubscription
}
type EventTargetLike = {
  addEventListener: (event: string, listener: () => void) => void
  removeEventListener: (event: string, listener: () => void) => void
}
type VisibilityDocument = EventTargetLike & {
  visibilityState: string
  hasFocus?: () => boolean
}

function activeStateObserver (initiallyActive: boolean, onResume: () => void) {
  let active = initiallyActive
  return (nextActive: boolean) => {
    const resumed = !active && nextActive
    active = nextActive
    if (resumed)
      onResume()
  }
}

export function watchNativeForeground (appState: NativeAppState, onResume: () => void) {
  const update = activeStateObserver(appState.currentState === 'active', onResume)
  const subscription = appState.addEventListener('change', state => update(state === 'active'))
  return () => subscription.remove()
}

export function watchWebForeground (
  document: VisibilityDocument,
  window: EventTargetLike,
  onResume: () => void
) {
  const visible = () => document.visibilityState === 'visible'
  const hasFocus = () => document.hasFocus?.() ?? true
  const update = activeStateObserver(visible() && hasFocus(), onResume)
  const onVisibilityChange = () => update(visible() && hasFocus())
  const onFocus = () => update(visible())
  const onBlur = () => update(false)

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('blur', onBlur)
  }
}
