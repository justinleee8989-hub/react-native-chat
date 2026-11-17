import { Redirect } from 'expo-router'

/** Keep legacy deep links pointing to the single contacts master. */
export default function ContactsRoute () {
  return <Redirect href='/(tabs)/contacts' />
}
