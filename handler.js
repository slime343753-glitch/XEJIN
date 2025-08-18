import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { pathToFileURL } from 'url'
import chokidar from 'chokidar'
import pino from 'pino'

// Proper Pino logger configuration
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
})

// 🔄 Hot-reload config
let config = await import('./config.js').then(m => m.default)
setInterval(async () => {
  try {
    const newConfig = await import(`./config.js?update=${Date.now()}`).then(m => m.default)
    config.owner = newConfig.owner
    logger.debug('Config reloaded successfully')
  } catch (err) {
    logger.error('Config reload failed:', err)
  }
}, 5000)

const PLUGIN_DIR = path.resolve('./plugins')
const plugins = new Map()
const pluginStats = new Map()

// 🔄 Plugin Loader
export async function loadPlugins(dir = PLUGIN_DIR) {
  try {
    const files = await fs.promises.readdir(dir)
    const loadPromises = files.map(async (file) => {
      const fullPath = path.join(dir, file)
      try {
        const stat = await fs.promises.stat(fullPath)
        if (stat.isDirectory()) {
          return loadPlugins(fullPath)
        } else if (file.endsWith('.js')) {
          return loadPlugin(fullPath)
        }
      } catch (err) {
        logger.error(`Error loading ${file}:`, err.message)
      }
    })
    
    await Promise.all(loadPromises)
    logger.info(`Successfully loaded ${plugins.size} plugins`)
  } catch (err) {
    logger.error('Error reading plugin directory:', err.message)
  }

  const watcher = chokidar.watch(dir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  })

  watcher.on('change', async (filePath) => {
    if (filePath.endsWith('.js')) {
      logger.info(`Reloading plugin: ${path.basename(filePath)}`)
      try {
        await loadPlugin(filePath, true)
      } catch (err) {
        logger.error(`Failed to reload ${filePath}:`, err.message)
      }
    }
  })
}

// 📦 Load a single plugin
async function loadPlugin(fullPath, isReload = false) {
  const file = path.basename(fullPath)
  if (!fs.existsSync(fullPath)) return

  const pluginURL = `${pathToFileURL(fullPath).href}?cacheBust=${Date.now()}`
  try {
    if (isReload) {
      Object.keys(require.cache).forEach(key => {
        if (key.includes(fullPath)) delete require.cache[key]
      })
    }

    const imported = await import(pluginURL)
    const plugin = imported.default

    if (plugin?.run) {
      const name = plugin.name || file.replace('.js', '')

      for (const [key, val] of plugins) {
        if (val === plugins.get(name)) plugins.delete(key)
      }

      plugins.set(name.toLowerCase(), plugin)
      pluginStats.set(name, { 
        file: fullPath, 
        lastLoaded: Date.now(),
        loadCount: (pluginStats.get(name)?.loadCount || 0) + 1
      })

      if (Array.isArray(plugin.command)) {
        plugin.command.forEach(cmd => plugins.set(cmd.toLowerCase(), plugin))
      } else if (typeof plugin.command === 'string') {
        plugins.set(plugin.command.toLowerCase(), plugin)
      }

      logger.info(`${isReload ? '♻️ Reloaded' : '📦 Loaded'}: ${file}`)
    }
  } catch (err) {
    logger.error(`Failed to ${isReload ? 'reload' : 'load'} ${file}:`, err)
  }
}

// ✅ Handle command execution
export async function handleCommand({ msg, sock, prefix, text, from, sender, isGroup }) {
  try {
    const senderJid = msg.key.participant || msg.key.remoteJid
    const senderNum = sender?.replace(/\D/g, '')
    const [cmdNameRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
    const cmdName = cmdNameRaw.toLowerCase()
    const plugin = plugins.get(cmdName)

    // Load private groups data
    let privateGroups = []
    try {
      privateGroups = JSON.parse(fs.readFileSync('./database/private_groups.json', 'utf-8'))
    } catch (e) {
      console.error('Error loading private groups:', e)
    }

    const isPrivateGroup = privateGroups.includes(from)
    const isOwner = config.owner.some(o => String(o).replace(/\D/g, '') === senderNum)

    // Silent ignore for non-owners in private groups
    if (isPrivateGroup && !isOwner) {
      return // Exit silently without response
    }

    // Handle unknown commands
    if (!plugin) {
      if (/^[a-z]/i.test(cmdName)) {
        await sock.sendMessage(from, {
          text: `⛧💗𝙉𝙊 𝙎𝙐𝘾𝙃 𝘾𝙊𝙈𝙈𝘼𝙉𝘿 𝘽𝘼𝙆𝘼⛧`,
          react: { text: '❓', key: msg.key }
        }).catch(() => {})
      }
      return // Exit after handling unknown command
    }

    // Owner-only command check
    if (plugin.type === 'owner' && !isOwner) {
      return sock.sendMessage(from, {
        text: `⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n⚰ 𝐅𝐎𝐑𝐁𝐈𝐃𝐃𝐄𝐍 ⚰\n⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n\n☠ 𝐎𝐧𝐥𝐲 𝐦𝐲 𝐝𝐚𝐫𝐤 𝐜𝐫𝐞𝐚𝐭𝐨𝐫 𝐜𝐚𝐧 𝐮𝐬𝐞 𝐭𝐡𝐢𝐬`,
        react: { text: '⚠️', key: msg.key }
      }).catch(() => {})
    }

    // Admin-only command check
    if (plugin.adminOnly && isGroup) {
      try {
        const groupMeta = await sock.groupMetadata(from)
        const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id)
        const isAdmin = admins.includes(senderJid)

        if (!isAdmin && !isOwner) {
          return sock.sendMessage(from, {
            text: `⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n⚰ 𝐃𝐄𝐍𝐈𝐄𝐃 ⚰\n⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n\n☠ 𝐘𝐨𝐮 𝐧𝐞𝐞𝐝 𝐚𝐝𝐦𝐢𝐧 𝐫𝐢𝐠𝐡𝐭𝐬 𝐟𝐨𝐫 𝐭𝐡𝐢𝐬`,
            react: { text: '🚫', key: msg.key }
          }).catch(() => {})
        }
      } catch (err) {
        console.error('⛧ Failed to check admin status:', err)
        return
      }
    }

    // Execute the command
    await plugin.run({ msg, sock, args, prefix, from, sender, isGroup, config })
  } catch (e) {
    console.error('⛧ Command execution error:', e)
    await sock.sendMessage(from, {
      text: `⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n⚰ 𝐄𝐑𝐑𝐎𝐑 ⚰\n⛧▰▰▰▰▰▰▰▰▰▰▰▰⛧\n\n☠ 𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐟𝐚𝐢𝐥𝐞𝐝\n\n⚡ ${e.message || 'Unknown error'}`,
      react: { text: '💢', key: msg.key }
    }).catch(() => {})
  }
}
// 🔘 Handle button events
export async function handleButton({ msg, sock, prefix = '.' }) {
  try {
    const buttonId = msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.templateButtonReplyMessage?.selectedId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId

    if (!buttonId) return

    const fakeMsg = {
      ...msg,
      message: {
        conversation: prefix + buttonId
      }
    }

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const text = prefix + buttonId

    await handleCommand({
      msg: fakeMsg,
      sock,
      prefix,
      text,
      from,
      sender,
      isGroup
    })

    for (const plugin of plugins.values()) {
      if (typeof plugin.onMessage === 'function') {
        try {
          await plugin.onMessage({ msg, sock, buttonId })
        } catch (err) {
          logger.error('Button handler error:', err)
        }
      }
    }
  } catch (error) {
    logger.error('Button processing error:', error)
  }
}

// 💬 Passive hooks
export async function runPassiveHooks({ sock, msg, text, from, sender, isGroup }) {
  for (const plugin of plugins.values()) {
    if (typeof plugin.onMessage === 'function') {
      try {
        const result = await plugin.onMessage({ msg, sock, text, from, sender, isGroup })
        if (result) return true
      } catch (err) {
        logger.error('Passive hook error:', err)
      }
    }
  }
  return false
}

// 👥 Group join events
export async function handleGroupJoin({ sock, user, group }) {
  for (const plugin of plugins.values()) {
    if (plugin.type === 'auto' && typeof plugin.onJoin === 'function') {
      try {
        await plugin.onJoin({ sock, user, group })
      } catch (err) {
        logger.error('Group join handler error:', err)
      }
    }
  }
}

// Utility
export function getAllPlugins() {
  return plugins
}