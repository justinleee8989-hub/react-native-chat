import { client, getSDKClient } from './client'
import { createConversationService } from './conversation-service'

export const conversationService = createConversationService(getSDKClient, (sourceID, sessionType) => client.conversation(sourceID, sessionType))
