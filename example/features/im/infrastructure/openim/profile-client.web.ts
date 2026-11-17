import { getSDKClient } from './client.web'
import { createProfileService } from './profile-service'
import { fetchSelfProfile } from './self-profile-api'

export const profile = createProfileService(getSDKClient, value => (value as { data: unknown }).data, fetchSelfProfile)
