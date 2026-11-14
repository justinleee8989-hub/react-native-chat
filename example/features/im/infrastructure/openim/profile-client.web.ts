import { getSDKClient } from './client.web'
import { createProfileService } from './profile-service'

export const profile = createProfileService(getSDKClient, value => (value as { data: unknown }).data)
