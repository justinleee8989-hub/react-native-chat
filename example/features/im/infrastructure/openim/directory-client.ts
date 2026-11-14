import { getSDKClient } from './client'
import { createDirectoryService } from './directory-service'

export const directory = createDirectoryService(getSDKClient, value => value)
