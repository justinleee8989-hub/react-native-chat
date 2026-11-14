import type { Person } from './directory'

export interface SelfProfile extends Person { globalRecvMsgOpt?: number }
export interface ProfilePatch { nickname?: string, faceURL?: string, globalRecvMsgOpt?: 0 | 2 }
