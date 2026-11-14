import { assertGroupManagement, type GroupManagementPermission } from '../domain/group-management'
import { groupManagement } from '../infrastructure/openim/group-management-client'
import { directory } from './directory'

export { groupManagement }
export const groupApplicationEvents = ['onGroupApplicationAdded', 'onGroupApplicationAccepted', 'onGroupApplicationRejected', 'onGroupApplicationDeleted']

export async function checkGroupManagement (groupID: string, userID: string, current: () => boolean, permission: GroupManagementPermission, targetID?: string) {
  const [self, target] = await Promise.all([
    directory.member(groupID, userID),
    targetID ? directory.member(groupID, targetID) : Promise.resolve(undefined),
  ])
  assertGroupManagement(current(), permission, self, target)
}
