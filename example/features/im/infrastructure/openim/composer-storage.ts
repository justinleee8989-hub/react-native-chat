import AsyncStorage from '@react-native-async-storage/async-storage'

function mentionKey (userID: string, conversationID: string) {
  return `im-composer:v1:${encodeURIComponent(userID)}:${encodeURIComponent(conversationID)}:mentions`
}

export async function readDraftMentions (userID: string, conversationID: string) {
  const value = await AsyncStorage.getItem(mentionKey(userID, conversationID))
  if (!value)
    return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(id => typeof id === 'string') ? parsed : []
  } catch {
    return []
  }
}

export async function writeDraftMentions (userID: string, conversationID: string, memberIDs: string[]) {
  const key = mentionKey(userID, conversationID)
  if (memberIDs.length)
    return AsyncStorage.setItem(key, JSON.stringify([...new Set(memberIDs)]))
  return AsyncStorage.removeItem(key)
}
