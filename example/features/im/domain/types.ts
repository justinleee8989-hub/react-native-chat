export interface IMMessage {
  clientMsgID: string
  seq?: number
  sendID?: string
  recvID?: string
  groupID?: string
  sendTime: number
  createTime?: number
  status: number
  contentType: number
  senderNickname?: string
  senderFaceUrl?: string
  textElem?: { content: string }
  atTextElem?: { text: string, atUserList: string[], atUsersInfo?: { atUserID: string, groupNickname: string }[] }
  quoteElem?: { text: string, quoteMessage: IMMessage }
  notificationElem?: { detail: string }
  isRead?: boolean
  uploadProgress?: number
  pictureElem?: {
    sourcePath?: string
    sourcePicture?: { url?: string }
    snapshotPicture?: { url?: string }
  }
  soundElem?: { sourceUrl?: string, soundPath?: string, duration?: number }
  videoElem?: { videoUrl?: string, videoPath?: string, duration?: number }
  fileElem?: { sourceUrl?: string, filePath?: string, fileName?: string, fileSize?: number }
  /** Display-only edits/reactions supplied by the message extras service. Never send to the SDK. */
  projection?: { text?: string, editedAt?: number, reactions?: Record<string, Record<string, boolean>>, revision: number }
}
export interface Conversation {
  conversationID: string
  conversationType: number
  userID?: string
  groupID?: string
  showName: string
  faceURL?: string
  unreadCount: number
  latestMsg?: string
  draftText?: string
  isPinned?: boolean
  recvMsgOpt?: number
  ex?: string
}
export interface Session {
  userID: string
  imToken: string
  chatToken?: string
}
export interface ServerConfig {
  chat: string
  api: string
  ws: string
}
export interface IMClient {
  login: (session: Session, config: ServerConfig) => Promise<void>
  logout: () => Promise<void>
  on: (event: string, handler: (data: unknown) => void) => () => void
  conversations: (offset: number) => Promise<Conversation[]>
  conversation: (sourceID: string, sessionType?: number) => Promise<Conversation>
  history: (
    id: string,
    startClientMsgID: string
  ) => Promise<{ messageList: IMMessage[], isEnd: boolean }>
  createMedia: (media: MediaInput) => Promise<IMMessage>
  createText: (text: string) => Promise<IMMessage>
  createQuote: (text: string, message: IMMessage) => Promise<IMMessage>
  createForward: (message: IMMessage) => Promise<IMMessage>
  revoke: (conversationID: string, clientMsgID: string) => Promise<unknown>
  search: (conversationID: string, keyword: string, page: number) => Promise<{ messages: IMMessage[], total: number }>
  send: (message: IMMessage, conversation: Conversation) => Promise<IMMessage>
  read: (id: string) => Promise<unknown>
}

export interface MediaInput {
  type: 'image' | 'video' | 'file' | 'audio'
  uri: string
  name?: string
  mimeType?: string
  width?: number
  height?: number
  duration?: number
}
