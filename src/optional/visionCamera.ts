import { Platform } from 'react-native'

export function loadVisionCamera (): any {
  // Retain this guard for resolvers that do not select the .web implementation.
  if (Platform.OS === 'web')
    return null
  try {
    // VisionCamera initializes its native CameraFactory on import. A package installed
    // without its native binary is unavailable, just like a missing optional peer.
    return require('react-native-vision-camera')
  } catch {
    return null
  }
}
