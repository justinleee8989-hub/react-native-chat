import { Redirect } from 'expo-router'

/** 通话 is a main section now; old links to the page under 我的 land on it. */
export default function CallHistoryRedirect () {
  return <Redirect href='/(tabs)/calls' />
}
