import fs from 'fs'
import config from '../../config.js'

const globalModePath = './database/mode.json'
const groupModePath = './database/group-mode.json'

function readJSON(path, fallback = {}) {
  try {
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify(fallback, null, 2))
    return JSON.parse(fs.readFileSync(path))
  } catch (e) {
    console.error(`⚠️ Failed to read ${path}:`, e)
    return fallback
  }
}

function saveJSON(path, data) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error(`⚠️ Failed to save ${path}:`, e)
  }
}

export default {
  name: 'mode',
  command: ['mode', 'setmode'],
  desc: '⛧ Control bot mode (public/private/reset/status)',
  type: 'admin',

  async run({ msg, sock, args, from, sender, isGroup }) {
    const cleanSender = sender.replace(/@.+/, '')
    const isOwner = config.owners?.some(o => o.number.replace(/\D/g, '') === cleanSender) ||
                    config.owner?.includes(cleanSender)

    if (!isOwner) {
      return sock.sendMessage(from, {
        text: '🩸 *The darkness ignores you... Only the Creator may wield this command.*'
      }, { quoted: msg })
    }

    const input = args[0]?.toLowerCase()
    const validModes = ['public', 'private', 'reset', 'status']

    if (!input || !validModes.includes(input)) {
      return sock.sendMessage(from, {
        text: `
╭─⛧ 𝐌𝐎𝐃𝐄 𝐂𝐎𝐍𝐓𝐑𝐎𝐋 𝐏𝐀𝐍𝐄𝐋 ⛧─╮
│ 🪷 .mode public — Unleash bot to all
│ 🕯 .mode private — Restrict to creator only
│ ♻ .mode reset — Remove gc override
│ 🧾 .mode status — Show current status
╰────────────────────╯`.trim()
      }, { quoted: msg })
    }

    const globalMode = readJSON(globalModePath, { mode: 'public' })
    const groupModes = readJSON(groupModePath, {})

    // 🧾 Status Mode
    if (input === 'status') {
      let text = `🧾 𝐂𝐔𝐑𝐑𝐄𝐍𝐓 𝐒𝐓𝐀𝐓𝐄 🧾\n\n`
      text += `🌐 𝐆𝐥𝐨𝐛𝐚𝐥 𝐌𝐨𝐝𝐞: *${globalMode.mode.toUpperCase()}*\n`
      if (isGroup) {
        const gcMode = groupModes[from]?.toUpperCase() || 'None'
        text += `👥 𝐆𝐫𝐨𝐮𝐩 𝐎𝐯𝐞𝐫𝐫𝐢𝐝𝐞: *${gcMode}*`
      }
      return sock.sendMessage(from, { text }, { quoted: msg })
    }

    // ♻ Reset GC override
    if (input === 'reset' && isGroup) {
      delete groupModes[from]
      saveJSON(groupModePath, groupModes)
      return sock.sendMessage(from, {
        text: '♻️ Override cleared for this group.'
      }, { quoted: msg })
    }

    // 🩶 GC override
    if (isGroup) {
      groupModes[from] = input
      saveJSON(groupModePath, groupModes)
      return sock.sendMessage(from, {
        text: `🌑 This group is now set to: *${input.toUpperCase()}*`
      }, { quoted: msg })
    }

    // 🌐 Global mode
    saveJSON(globalModePath, { mode: input, lastChanged: new Date().toISOString() })
    return sock.sendMessage(from, {
      text: `🌐 The entire realm is now *${input.toUpperCase()}*`
    }, { quoted: msg })
  }
}