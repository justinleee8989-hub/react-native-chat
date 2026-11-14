import { getSDKClient } from './client.web'
import { createGroupManagementService } from './group-management-service'

export const groupManagement = createGroupManagementService(getSDKClient, value => (value as { data: unknown }).data)
