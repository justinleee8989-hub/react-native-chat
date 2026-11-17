import test from 'node:test'
import assert from 'node:assert/strict'
import { applyInitialMedia } from './media-setup.ts'
test('starts the selected media only, releases a late grant after hangup', async () => {
 let active = true
 const seen = []
 const room = { localParticipant: { trackPublications: new Map([['mic', {track:{stop:()=>seen.push(['stop'])}}]]), setMicrophoneEnabled: async v => { seen.push(['mic', v]); if (v) active = false }, setCameraEnabled: async v => seen.push(['camera', v]) } }
 await applyInitialMedia(room, { microphone: true, camera: true, speaker: true }, () => active)
 assert.deepEqual(seen, [['mic', true], ['stop'], ['mic', false]])
})
test('does not open a camera when outgoing preference was off', async () => {
 const seen = []
 const room = { localParticipant: { setMicrophoneEnabled: async v => seen.push(['mic', v]), setCameraEnabled: async v => seen.push(['camera', v]) } }
 await applyInitialMedia(room, { microphone: false, camera: false, speaker: true }, () => true)
 assert.deepEqual(seen, [['mic', false], ['camera', false]])
})
