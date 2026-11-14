// VisionCamera and Nitro import native React Native internals at module scope.
// Keep their entire dependency tree out of browser builds, including development refresh.
export function loadVisionCamera (): null {
  return null
}
