global.plugins = {}

import baileys from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import pino from 'pino'
import figlet from 'figlet'
import { terminalLogger, showStartupBanner } from './terminal.js'
import gradient from 'gradient-string'
import qrcode from 'qrcode-terminal'
import chokidar from 'chokidar'
import config from './config.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import {
  handleCommand,
  handleButton,
  runPassiveHooks,
  handleGroupJoin,
  loadPlugins as loadHandlerPlugins
} from './handler.js'

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  isJidBroadcast
} = baileys

// Proper Pino logger configuration
const logger = pino({
  level: 'warn',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pluginDir = path.join(__dirname, 'plugins')
const bannedPath = './database/banned.json'

if (!fs.existsSync(bannedPath)) fs.writeFileSync(bannedPath, '[]')

let bannedList = JSON.parse(fs.readFileSync(bannedPath))
global.bannedUsers = new Set(Array.isArray(bannedList) ? bannedList : [])

function banner() {
  console.clear()
  console.log(gradient.pastel(figlet.textSync('⟦ 제진𝙓𝙀𝙅𝙄𝙉 ⟧')))
  console.log(chalk.magenta(`╔═─━「 𝙓𝙀𝙅𝙄𝙉 」━═╗`))
  console.log(chalk.cyan(`┃ 📲 Powered by Baileys`))
  console.log(chalk.cyan(`┃ 🔁 Plugin Hot Reload Enabled`))
  console.log(chalk.magenta(`╚═─━「 🟢 Starting... 」━═╝\n`))
}

banner()

export function saveBans() {
  fs.writeFileSync(bannedPath, JSON.stringify([...global.bannedUsers], null, 2))
}

function extractMessageContent(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.audioMessage?.caption ||
    ''
  )
}

;(async () => {
  try {
    await loadHandlerPlugins()

    const watcher = chokidar.watch(pluginDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    })

    watcher.on('change', async () => {
      logger.info('Reloading plugins...')
      await loadHandlerPlugins()
    })

    async function startBot() {
      const { version, isLatest } = await fetchLatestBaileysVersion()
      if (!isLatest) {
        logger.warn('Using outdated Baileys version, consider updating!')
      }

      const { state, saveCreds } = await useMultiFileAuthState('./auth')

      const sock = makeWASocket({
        version,
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        browser: ['제진𝙓𝙀𝙅𝙄𝙉', 'Termux', '1.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async () => undefined,
        shouldIgnoreJid: jid => isJidBroadcast(jid),
        transactionOpts: {
          maxCommitRetries: 3,
          delayBetweenTriesMs: 1000
        }
      })

      let retryCount = 0
      const maxRetries = 5
      const reconnectInterval = (retryCount) => Math.min(5000 + (retryCount * 2000), 30000)

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          qrcode.generate(qr, { small: true })
          logger.info(chalk.gray('🔗 Scan QR from WhatsApp > Linked Devices'))
        }
        
        if (connection === 'open') {
          retryCount = 0
          logger.info(chalk.green('✅ 제진𝙓𝙀𝙅𝙄𝙉 ONLINE!'))
        }
        
        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
          
          if (shouldReconnect && retryCount < maxRetries) {
            retryCount++
            const delay = reconnectInterval(retryCount)
            logger.warn(`🔁 Reconnecting in ${delay/1000}s... (Attempt ${retryCount}/${maxRetries})`)
            setTimeout(startBot, delay)
          } else {
            logger.error('❌ Max reconnection attempts reached or logged out')
            process.exit(1)
          }
        }
      })

      showStartupBanner('XEJIN', '2.0')

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        
        const msg = messages[0]
       // if (!msg?.message || msg.key.fromMe) return

        try {
          await terminalLogger(msg, sock)
          
          const from = msg.key.remoteJid
          const sender = msg.key.participant || from
          const isGroup = from.endsWith('@g.us')
          const text = extractMessageContent(msg.message)

          const buttonId = msg.message?.buttonsResponseMessage?.selectedButtonId ||
            msg.message?.templateButtonReplyMessage?.selectedId

          if (buttonId) {
            await handleButton({ msg, sock }).catch(err => 
              logger.error('Button handler error:', err)
            )
          }

          const passive = await runPassiveHooks({ sock, msg, text, from, sender, isGroup })
          if (passive) return

          const prefix = config.prefix.find(p => text.startsWith(p))
          if (prefix) {
            await handleCommand({ msg, sock, prefix, text, from, sender, isGroup })
          }
        } catch (error) {
          logger.error('Message processing error:', error)
        }
      })

      sock.ev.on('group-participants.update', async (update) => {
        try {
          const { id, participants, action } = update
          if (action === 'add') {
            for (const user of participants) {
              await handleGroupJoin({ sock, user, group: id })
            }
          }
        } catch (error) {
          logger.error('Group update error:', error)
        }
      })
    }

    await startBot()
  } catch (err) {
    logger.error('Fatal initialization error:', err)
    process.exit(1)
  }
})()