import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMessageReaders } from './readers.ts'

test('reader details require authenticated synchronized messages', async () => {
  await assert.rejects(fetchMessageReaders({userID:'qa',imToken:'im'}, 'http://local', 'g', 'm', 1), /登录/)
  await assert.rejects(fetchMessageReaders({userID:'qa',imToken:'im',chatToken:'chat'}, 'http://local', 'g', 'm', 0), /同步/)
})
test('reader request uses chat authentication and exact original message identity', async t => {
  const result={members:[{userID:'other',read:true}],readCount:1,unreadCount:0,excludedJoinedLater:0}
  t.mock.method(globalThis,'fetch',async (url, options)=>{
    assert.equal(url,'http://local/user/message/readers')
    assert.equal(options.headers.token,'chat')
    assert.deepEqual(JSON.parse(options.body),{conversationID:'g',messageID:'m',seq:3})
    return {ok:true,json:async()=>({errCode:0,data:result})}
  })
  assert.deepEqual(await fetchMessageReaders({userID:'qa',imToken:'im',chatToken:'chat'},'http://local/','g','m',3),result)
})
test('read failures are explicit, never rendered as everyone unread', async t => {
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({errCode:1002,errMsg:'无权限'})}))
  await assert.rejects(fetchMessageReaders({userID:'qa',imToken:'im',chatToken:'chat'},'http://local','g','m',3),/无权限/)
})
