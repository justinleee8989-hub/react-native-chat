import test from 'node:test'
import assert from 'node:assert/strict'
import * as extras from './extras.ts'
const { applyExtras, batchMessageIDs, mergeMessageExtras } = extras
const resolveExtraSequence = (...args) => extras.resolveExtraSequence(...args)
test('edits and actor reactions overlay the official message without changing original',()=>{
 const source={_id:'a',text:'original',user:{_id:'alice'}}
 const result=applyExtras(source,{text:'edited',editedAt:12,reactions:{'👍':{bob:true}},revision:1})
 assert.equal(result.text,'edited');assert.equal(source.text,'original');assert.equal(result.isEdited,true)
 assert.deepEqual(result.reactions,[{emoji:'👍',userIds:['bob']}])
})
test('system or revoked messages never resurrect edited text',()=>{
 const source={_id:'a',text:'撤回',system:true,user:{_id:'system'}}
 assert.equal(applyExtras(source,{text:'edited',revision:1}).text,'撤回')
})
test('late mutation responses cannot overwrite a newer extra revision',()=>{
 const current={a:{text:'newer',revision:3}}
 assert.deepEqual(mergeMessageExtras(current,{a:{text:'older',revision:2}}),current)
 assert.deepEqual(mergeMessageExtras(current,{a:{text:'latest',revision:4}}),{a:{text:'latest',revision:4}})
})
test('a poll that changes nothing keeps the same extras object',()=>{
 const current={a:{text:'same',revision:3,reactions:{'👍':{bob:true}}}}
 assert.equal(mergeMessageExtras(current,{a:{text:'same',revision:3,reactions:{'👍':{bob:true}}}}),current)
 assert.equal(mergeMessageExtras(current,{}),current)
 assert.notEqual(mergeMessageExtras(current,{b:{text:'new',revision:1}}),current)
})
test('message extra reads are split into ordered batches of at most 100',()=>{
 const ids=Array.from({length:205},(_,index)=>`message-${index}`)
 const batches=batchMessageIDs(ids)
 assert.deepEqual(batches.map(batch=>batch.length),[100,100,5])
 assert.deepEqual(batches.flat(),ids)
 assert.deepEqual(batchMessageIDs([]),[])
})

test('extra mutations resolve an unsynced seq from server history',async()=>{
 const cursors=[]
 const seq=await resolveExtraSequence({clientMsgID:'target',seq:0},async cursor=>{
  cursors.push(cursor)
  return {messages:[{clientMsgID:'target',seq:2}],hasMore:false,cursor:''}
 })
 assert.equal(seq,2)
 assert.deepEqual(cursors,[''])
})
test('extra mutations reject when server history has no target message',async()=>{
 await assert.rejects(resolveExtraSequence({clientMsgID:'missing',seq:0},async()=>({messages:[],hasMore:false,cursor:''})),/同步/)
})
test('extra mutations reject a target with no positive server sequence',async()=>{
 await assert.rejects(resolveExtraSequence({clientMsgID:'target',seq:0},async()=>({messages:[{clientMsgID:'target',seq:0}],hasMore:false,cursor:''})),/同步/)
})
test('extra sequence pagination rejects a non-advancing cursor',async()=>{
 await assert.rejects(resolveExtraSequence({clientMsgID:'target',seq:0},async()=>({messages:[],hasMore:true,cursor:''})),/分页未前进|游标.*前进/)
})
test('known positive extra sequence avoids a history read',async()=>{
 let calls=0
 const seq=await resolveExtraSequence({clientMsgID:'target',seq:2},async()=>{calls++;return {messages:[],hasMore:false,cursor:''}})
 assert.equal(seq,2)
 assert.equal(calls,0)
})
test('extra sequence resolution follows cursor pages to the target',async()=>{
 const cursors=[]
 const pages=[
  {messages:[{clientMsgID:'other',seq:1}],hasMore:true,cursor:'next'},
  {messages:[{clientMsgID:'target',seq:4}],hasMore:false,cursor:''},
 ]
 const seq=await resolveExtraSequence({clientMsgID:'target',seq:0},async cursor=>{
  cursors.push(cursor)
  return pages.shift()
 })
 assert.equal(seq,4)
 assert.deepEqual(cursors,['','next'])
})
test('extra sequence resolution rejects a repeated cursor cycle',async()=>{
 let calls=0
 await assert.rejects(resolveExtraSequence({clientMsgID:'target',seq:0},async cursor=>{
  calls++
  return {messages:[],hasMore:true,cursor:cursor ? 'first' : 'first'}
 }),/分页未前进|游标.*前进/)
 assert.equal(calls,2)
})
