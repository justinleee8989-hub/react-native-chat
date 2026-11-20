const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

// This Mac's private LAN addresses at prebuild: the local deployment hands out LiveKit on the
// LAN address, which a real device needs, and WebRTC cannot go through USB reverse.
function lanAddresses () {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item?.family === 'IPv4' && !item.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
    .map(item => item.address)
}

// Opt-in only: USB reverse connects local QA services through the device loopback, the emulator
// reaches this Mac on 10.0.2.2, and the call media on its LAN address.
module.exports = config => {
  config = withAndroidManifest(config, mod => {
    mod.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/local_qa_network_security'
    return mod
  })
  return withDangerousMod(config, ['android', async mod => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml')
    await fs.mkdir(directory, { recursive: true })
    const hosts = [...new Set(['127.0.0.1', 'localhost', '10.0.2.2', ...lanAddresses()])]
    await fs.writeFile(path.join(directory, 'local_qa_network_security.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${hosts.map(host => `    <domain includeSubdomains="false">${host}</domain>`).join('\n')}
  </domain-config>
</network-security-config>
`)
    return mod
  }])
}
