import React, { useState } from 'react'
import { groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { Action, Confirm, Field, Label, Page } from '../shared/shared'
import { useTask } from '../shared/useTask'

export default function JoinGroupScreen() {
  const { session } = useOpenIM()
  return session ? <JoinGroup key={`${session.userID}:${session.imToken}`} /> : <LoginScreen />
}
function JoinGroup() {
  const task = useTask()
  const [id, setID] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<{ id: string, reason: string }>()
  return (
    <Page title='通过群 ID 加群' {...task}>
      <Field value={id} onChangeText={setID} placeholder='群 ID' />
      <Field value={reason} onChangeText={setReason} placeholder='申请理由（选填）' />
      <Label>是否需要审核由群设置决定。提交后可在群申请中查看结果。</Label>
      {!!notice && <Label>{notice}</Label>}
      <Action
        title='申请加群'
        disabled={task.busy || !id.trim()}
        onPress={() => setConfirm({ id: id.trim(), reason })}
      />
      {confirm && (
        <Confirm
          busy={task.busy}
          message={`确认申请加入群 ${confirm.id}？`}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void task.run(async current => {
              await groupManagement.join(confirm.id, confirm.reason)
              if (current()) {
                setConfirm(undefined)
                setNotice(
                  '加群请求已提交；如需审核，请等待群主或管理员处理。可刷新群列表或群申请查看结果。'
                )
              }
            })
          }}
        />
      )}
    </Page>
  )
}
