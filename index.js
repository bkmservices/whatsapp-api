const { Boom } = require('@hapi/boom')
const NodeCache = require('@cacheable/node-cache')
const readline = require('readline')
const makeWASocket = require('../src')
const P = require('pino')

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

const usePairingCode = process.argv.includes('--use-pairing-code')

// Read line interface
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

// start a connection
const startSock = async () => {
  const { state, saveCreds } = await makeWASocket.useMultiFileAuthState('baileys_auth_info')
  // fetch latest version of WA Web
  const { version, isLatest } = await makeWASocket.fetchLatestBaileysVersion()
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: !usePairingCode,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    msgRetryCounterCache: new NodeCache(),
    generateHighQualityLinkPreview: true,
    getMessage,
  })

  // Pairing code for Web clients
  if (usePairingCode && !sock.authState.creds.registered) {
    const phoneNumber = await question('Please enter your phone number:\n')
    const code = await sock.requestPairingCode(phoneNumber)
    console.log(`Pairing code: ${code}`)
  }

  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update']
      const { connection, lastDisconnect } = update
      if (connection === 'close') {
        if ((lastDisconnect?.error)?.output?.statusCode !== makeWASocket.DisconnectReason.loggedOut) {
          startSock() // reconnect if not logged out
        } else {
          console.log('Connection closed. You are logged out.')
        }
      }
      console.log('connection update', update)
    }

    if (events['creds.update']) {
      await saveCreds()
    }

    if (events['messages.upsert']) {
      const upsert = events['messages.upsert']
      console.log('recv messages ', JSON.stringify(upsert, undefined, 2))
      // Add logic here for replying, processing incoming messages
    }
  })

  return sock

  async function getMessage(key) {
    return undefined // Implement a way to retrieve messages if necessary
  }
}

startSock()
