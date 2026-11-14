import AsyncStorage from '@react-native-async-storage/async-storage'

// Separate from session storage: signing out retains recoverable account drafts.
export const draftStorage = AsyncStorage
