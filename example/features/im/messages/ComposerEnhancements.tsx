import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createComposerState } from '../application/composer-state'
import { reportError } from '../application/store'
import type { Conversation } from '../domain/types'
import type { MessageKey } from '../i18n'
import {
  changeInputState,
  createAtMessage,
  listGroupMembers,
  readDraft,
  subscribeInputStatus,
  writeDraft,
} from '../infrastructure/openim/composer-client'
import {
  getDraftStorageScope,
  clearDeliveredDraft,
  readDraftMentions,
  writeDraftMentions,
} from '../infrastructure/openim/composer-storage'
import { ProductError } from '../shared/product-error'

const drafts = createComposerState({
  getScope: getDraftStorageScope,
  clearDelivered: clearDeliveredDraft,
  read: readDraft,
  write: writeDraft,
  readMentions: readDraftMentions,
  writeMentions: writeDraftMentions,
})

export interface ComposerMember {
  userID: string
  nickname: string
  faceURL?: string
  roleLevel?: number
}

/**
 * Text uses OpenIM's conversation draft; selected @ IDs use account-scoped local storage.
 */
export function useComposerEnhancements (options: {
  userID: string
  conversation: Conversation
  typingThrottleMs?: number
  typingExpiryMs?: number
}) {
  const { userID, conversation } = options
  const [text, setText] = useState('')
  // Whether the draft or the typing status failed, as the key of what went wrong.
  const [draftError, setDraftError] = useState<MessageKey | null>(null)
  const [draftRetry, setDraftRetry] = useState(0)
  const [members, setMembers] = useState<ComposerMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(false)
  const [membersRetry, setMembersRetry] = useState(0)
  const [selectedMentionIDs, setSelectedMentionIDs] = useState<string[]>([])
  const [typing, setTyping] = useState(false)
  const [typingError, setTypingError] = useState<MessageKey | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const draftClearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exitFlushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sending = useRef(false)
  const lastNonemptyDraft = useRef('')
  const draftRevision = useRef(0)
  const mentionRevision = useRef(0)
  const mentionIDsRef = useRef<string[]>([])
  const textRef = useRef('')
  const activeKey = useRef('')
  const lastTypingAt = useRef(0)
  const serverScope = getDraftStorageScope()
  const convID = conversation.conversationID
  const isGroup = Boolean(conversation.groupID)

  useEffect(() => {
    const identity = `${userID}\u0000${serverScope}\u0000${convID}`
    const sameIdentity = activeKey.current === identity
    if (sameIdentity && exitFlushTimer.current) {
      clearTimeout(exitFlushTimer.current)
      exitFlushTimer.current = undefined
    }
    activeKey.current = identity
    drafts.setUser(userID)
    const restoringAtRevision = draftRevision.current
    let current = true
    if (!sameIdentity) {
      setText('')
      textRef.current = ''
      mentionIDsRef.current = []
      setSelectedMentionIDs([])
    }
    const restoringMentionsAtRevision = mentionRevision.current
    setDraftError(null)
    void Promise.all([drafts.restore(convID), drafts.restoreMentions(convID)])
      .then(([draft, ids]) => {
        if (!current)
          return
        if (
          draftRevision.current === restoringAtRevision &&
          (!sameIdentity || !textRef.current.trim())
        ) {
          lastNonemptyDraft.current = draft
          textRef.current = draft
          setText(draft)
        }
        if (
          mentionRevision.current === restoringMentionsAtRevision &&
          (!sameIdentity || !mentionIDsRef.current.length)
        ) {
          mentionIDsRef.current = ids
          setSelectedMentionIDs(ids)
        }
        setDraftError(null)
      })
      .catch(() => {
        if (current)
          setDraftError('composer.draftRestoreFailed')
      })
    return () => {
      current = false
      if (timer.current)
        clearTimeout(timer.current)
      if (draftClearTimer.current)
        clearTimeout(draftClearTimer.current)
      const draftAtExit = textRef.current
      const sendWasPending = sending.current
      exitFlushTimer.current = setTimeout(() => {
        exitFlushTimer.current = undefined
        if (activeKey.current === identity && getDraftStorageScope() === serverScope)
          void drafts
            .flushOnExit(userID, convID, draftAtExit, sendWasPending, serverScope)
            .catch(reportError)
      }, 0)
      if (userID && convID)
        void changeInputState(convID, false).catch(() =>
          setDraftError('composer.draftSaveFailed')
        )
    }
  }, [userID, serverScope, convID, draftRetry])

  useEffect(() => {
    let current = true
    if (!isGroup || !conversation.groupID) {
      setMembers([])
      setMembersError(false)
      setMembersLoading(false)
      return () => {
        current = false
      }
    }
    setMembers([])
    setMembersError(false)
    setMembersLoading(true)
    void listGroupMembers(conversation.groupID)
      .then(value => {
        if (current) {
          setMembers(value)
          setMembersLoading(false)
        }
      })
      .catch(() => {
        if (current) {
          setMembersError(true)
          setMembersLoading(false)
        }
      })
    return () => {
      current = false
    }
  }, [userID, isGroup, conversation.groupID, membersRetry])

  useEffect(() => {
    const expirations = new Map<string, ReturnType<typeof setTimeout>>()
    setTypingUsers([])
    const unsubscribe = subscribeInputStatus(status => {
      if (status.conversationID !== convID || status.userID === userID)
        return
      if (status.platformIDs?.length === 0) {
        if (expirations.has(status.userID))
          clearTimeout(expirations.get(status.userID))
        expirations.delete(status.userID)
        setTypingUsers(previous => previous.filter(id => id !== status.userID))
        return
      }
      if (expirations.has(status.userID))
        clearTimeout(expirations.get(status.userID))
      setTypingUsers(previous =>
        previous.includes(status.userID) ? previous : [...previous, status.userID]
      )
      expirations.set(
        status.userID,
        setTimeout(() => {
          expirations.delete(status.userID)
          setTypingUsers(previous => previous.filter(id => id !== status.userID))
        }, options.typingExpiryMs ?? 7000)
      )
    })
    return () => {
      unsubscribe()
      expirations.forEach(clearTimeout)
    }
  }, [convID, userID, options.typingExpiryMs])

  const typingFailureReported = useRef(false)
  const publishInputState = useCallback(
    (focus: boolean) => {
      void changeInputState(convID, focus)
        .then(() => {
          typingFailureReported.current = false
          setTypingError(null)
        })
        .catch(() => {
          if (typingFailureReported.current)
            return
          typingFailureReported.current = true
          setTypingError('composer.typingFailed')
        })
    },
    [convID]
  )

  const stopTyping = useCallback(() => {
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = undefined
    setTyping(false)
    if (convID)
      publishInputState(false)
  }, [convID, publishInputState])

  const startTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingAt.current >= (options.typingThrottleMs ?? 2500)) {
      lastTypingAt.current = now
      setTyping(true)
      publishInputState(true)
    }
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = setTimeout(stopTyping, options.typingExpiryMs ?? 7000)
  }, [options.typingExpiryMs, options.typingThrottleMs, publishInputState, stopTyping])

  const onDraftChange = useCallback(
    (value: string) => {
      draftRevision.current += 1
      textRef.current = value
      setText(value)
      if (value.trim()) {
        lastNonemptyDraft.current = value
        if (draftClearTimer.current)
          clearTimeout(draftClearTimer.current)
        void drafts
          .save(convID, value)
          .catch(() =>
            setDraftError('composer.draftSaveFailed')
          )
        startTyping()
      } else {
        stopTyping()
        if (draftClearTimer.current)
          clearTimeout(draftClearTimer.current)
        draftClearTimer.current = setTimeout(() => {
          if (!sending.current)
            void drafts
              .save(convID, '')
              .catch(() =>
                setDraftError('composer.draftSaveFailed')
              )
        }, 750)
      }
    },
    [convID, startTyping, stopTyping]
  )

  const sendWithDraft = useCallback(
    async <T,>(sendMessage: () => Promise<T>) => {
      if (draftClearTimer.current)
        clearTimeout(draftClearTimer.current)
      sending.current = true
      const requestKey = `${userID}\u0000${serverScope}\u0000${convID}`
      const revisionAtSend = draftRevision.current
      const mentionRevisionAtSend = mentionRevision.current
      const draftAtSend = lastNonemptyDraft.current
      const reportCleanupError = () => {
        if (activeKey.current === requestKey)
          reportError(new ProductError('composer.draftCleanupFailed'))
      }
      try {
        const result = await drafts.send(convID, sendMessage, reportCleanupError)
        if (activeKey.current === requestKey && draftRevision.current === revisionAtSend) {
          lastNonemptyDraft.current = ''
          textRef.current = ''
          setText('')
          stopTyping()
        }
        const clearMentionsAfterSend =
          activeKey.current === requestKey &&
          mentionRevision.current === mentionRevisionAtSend &&
          (draftRevision.current === revisionAtSend || !textRef.current.trim())
        if (clearMentionsAfterSend) {
          mentionIDsRef.current = []
          setSelectedMentionIDs([])
          if (draftRevision.current !== revisionAtSend)
            await drafts.saveMentions(convID, []).catch(reportCleanupError)
        }
        if (
          activeKey.current === requestKey &&
          draftRevision.current !== revisionAtSend &&
          !textRef.current.trim()
        )
          await drafts.save(convID, '').catch(reportCleanupError)
        return result
      } catch (error) {
        if (activeKey.current === requestKey && draftRevision.current === revisionAtSend) {
          textRef.current = draftAtSend
          setText(draftAtSend)
          await drafts.save(convID, draftAtSend)
        }
        throw error
      } finally {
        sending.current = false
      }
    },
    [userID, serverScope, convID, stopTyping]
  )

  const buildAtMessage = useCallback(
    (
      value: string,
      selected = members.filter(member => selectedMentionIDs.includes(member.userID))
    ) => {
      if (!isGroup)
        return Promise.reject(new ProductError('composer.mentionGroupOnly'))
      if (membersLoading)
        return Promise.reject(new ProductError('composer.membersLoading'))
      if (membersError)
        return Promise.reject(new ProductError('composer.membersFailed'))
      const valid = selected.filter(member =>
        members.some(candidate => candidate.userID === member.userID)
      )
      if (!valid.length)
        return Promise.reject(new ProductError('composer.pickMember'))
      return createAtMessage(value, valid)
    },
    [isGroup, members, membersLoading, membersError, selectedMentionIDs]
  )
  const selectMention = useCallback(
    (member: ComposerMember) => {
      if (!members.some(candidate => candidate.userID === member.userID))
        return
      const ids = [...new Set([...mentionIDsRef.current, member.userID])]
      mentionIDsRef.current = ids
      mentionRevision.current += 1
      setSelectedMentionIDs(ids)
      void drafts
        .saveMentions(convID, ids)
        .catch(() =>
          setDraftError('composer.draftSaveFailed')
        )
    },
    [convID, members]
  )
  const clearMentions = useCallback(() => {
    mentionIDsRef.current = []
    mentionRevision.current += 1
    setSelectedMentionIDs([])
    void drafts
      .saveMentions(convID, [])
      .catch(() =>
        setDraftError('composer.draftSaveFailed')
      )
  }, [convID])
  const selectedMentions = useMemo(
    () => members.filter(member => selectedMentionIDs.includes(member.userID)),
    [members, selectedMentionIDs]
  )
  const retryMembers = useCallback(() => setMembersRetry(value => value + 1), [])
  const retryDraft = useCallback(() => {
    if (!textRef.current && !mentionIDsRef.current.length) {
      setDraftRetry(value => value + 1)
      return
    }
    void drafts
      .save(convID, textRef.current)
      .then(() => drafts.saveMentions(convID, mentionIDsRef.current))
      .then(() => setDraftError(null))
      .catch(() =>
        setDraftError('composer.draftSaveFailed')
      )
  }, [convID])
  const restore = useCallback(async () => {
    setDraftRetry(value => value + 1)
  }, [])
  const typingUserItems = useMemo(
    () =>
      typingUsers.map(id => ({
        _id: id,
        name:
          members.find(member => member.userID === id)?.nickname ||
          (id === conversation.userID ? conversation.showName : id),
        avatar:
          members.find(member => member.userID === id)?.faceURL ||
          (id === conversation.userID ? conversation.faceURL : undefined),
      })),
    [typingUsers, members, conversation.userID, conversation.showName, conversation.faceURL]
  )

  return useMemo(
    () => ({
      text,
      onDraftChange,
      onFocus: startTyping,
      onBlur: stopTyping,
      sendWithDraft,
      restore,
      draftError,
      retryDraft,
      typingError,
      buildAtMessage,
      membersForGroup: members,
      membersLoading,
      membersError,
      retryMembers,
      selectedMentions,
      selectMention,
      clearMentions,
      isTyping: typingUserItems.length > 0,
      isTypingSelf: typing,
      typingUsers: typingUserItems,
    }),
    [
      text,
      onDraftChange,
      startTyping,
      stopTyping,
      sendWithDraft,
      restore,
      draftError,
      retryDraft,
      typingError,
      buildAtMessage,
      members,
      membersLoading,
      membersError,
      retryMembers,
      selectedMentions,
      selectMention,
      clearMentions,
      typing,
      typingUserItems,
    ]
  )
}
