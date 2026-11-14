import test from 'node:test'
import assert from 'node:assert/strict'
import { applyExtras, batchMessageIDs, mergeMessageExtras } from './extras.ts'
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
test('message extra reads are split into ordered batches of at most 100',()=>{
 const ids=Array.from({length:205},(_,index)=>`message-${index}`)
 const batches=batchMessageIDs(ids)
 assert.deepEqual(batches.map(batch=>batch.length),[100,100,5])
 assert.deepEqual(batches.flat(),ids)
 assert.deepEqual(batchMessageIDs([]),[])
})
