import { getSDKClient } from './client'
import { createGroupManagementService } from './group-management-service'

export const groupManagement = createGroupManagementService(getSDKClient, value => value)
