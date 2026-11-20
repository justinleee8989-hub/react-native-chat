import { useEffect } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import CallKeepAlive from '../../../modules/call-keep-alive'
import { useT } from '../i18n'

let notificationsAsked = false
// Asked once a run, at the first call: without it the call goes on, only its notification is not shown.
async function allowNotifications () {
  if (notificationsAsked || Platform.OS !== 'android' || Number(Platform.Version) < 33)
    return false
  notificationsAsked = true
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  if (await PermissionsAndroid.check(permission))
    return false
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED
}

// Keeps an Android call going while the app is in the background, with a notification that brings
// it back. Android lets it start only while the app is in front, so it starts once the call's
// media is set up on the call page, its permission prompts answered: a prompt still open would take
// the notification one's place. It starts again when the microphone or camera changes, so media
// allowed only later in the call is covered too.
export function useCallKeepAlive (call?: { title: string, microphone: boolean, camera: boolean }) {
  const tr = useT()
  const on = !!call && !!CallKeepAlive
  const title = call?.title || ''
  const microphone = !!call?.microphone
  const camera = !!call?.camera
  useEffect(() => {
    if (!on || !CallKeepAlive)
      return
    const service = CallKeepAlive
    let current = true
    const start = () => service.start(title, tr('call.ongoing'), tr('call.channel'), camera)
    start()
    void allowNotifications()
      .then(allowed => {
        // A notification allowed now is shown once the service starts again.
        if (allowed && current)
          start()
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [on, title, microphone, camera, tr])
  useEffect(() => {
    if (!on || !CallKeepAlive)
      return
    const service = CallKeepAlive
    return () => service.stop()
  }, [on])
}
