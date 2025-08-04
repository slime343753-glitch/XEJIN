import axios from 'axios'

export default {
  name: 'repo',
  command: ['repo', 'github', 'sc', 'code'],
  tags: ['info'],
  desc: '⛧ Show the XEJIN Bot GitHub repository',

  run: async ({ sock, msg }) => {
    const botName = '𝙓𝙀𝙅𝙄𝙉'
    const creator = '⛧ 𝐇𝐄𝐔𝐊𝐉𝐈𝐍 ⛧'
    const repoUrl = 'https://github.com/heukjin/XEJIN'
    const thumbUrl = 'https://files.catbox.moe/9laft3.jpg' // custom image

    // Newsletter context
    const newsletterInfo = {
      forwardingScore: 1,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363400771679306@newsletter',
        newsletterName: 'XEJIN',
        serverMessageId: -1
      }
    }

    // Try fetching thumbnail buffer
    let thumbnailBuffer = null
    try {
      const res = await axios.get(thumbUrl, { responseType: 'arraybuffer' })
      thumbnailBuffer = Buffer.from(res.data, 'binary')
    } catch (e) {
      console.warn('⚠️ Thumbnail fetch failed.')
    }

    // Minimal gothic caption
    const gothicCaption = `
🩸 *${botName} Repository*
━━━━━━━━━━━━━━━━━━━━━
🧑‍💻 *Creator:* ${creator}
📂 *Source:* GitHub Repo
🔗 *Link:* ${repoUrl}
    `.trim()

    // Send with externalAdReply and newsletter context
    await sock.sendMessage(msg.key.remoteJid, {
      text: gothicCaption,
      contextInfo: {
        ...newsletterInfo,
        externalAdReply: {
          title: `${botName} Source Code`,
          body: `Made by ${creator}`,
          thumbnail: thumbnailBuffer,
          mediaType: 1,
          renderLargerThumbnail: true,
          showAdAttribution: false,
          sourceUrl: repoUrl
        }
      }
    }, { quoted: msg })
  }
}