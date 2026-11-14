import { getSDKClient } from './client.web'
import { createDirectoryService } from './directory-service'

export const directory = createDirectoryService(
  getSDKClient,
  value => (value as { data: unknown }).data
)
