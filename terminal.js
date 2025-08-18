// terminal.js - Gothic Neon Theme with Animations
import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import boxen from 'boxen';
import { jidDecode } from '@whiskeysockets/baileys';

// ======================================
// 🦷🎨 GOTHIC NEON THEME CONFIGURATION
// ======================================
const GOTHIC_NEON_THEME = {
  COLORS: {
    BACKGROUND: '#0d021c',
    PRIMARY_NEON: '#8a2be2',
    SECONDARY_NEON: '#e91e63',
    TEXT: '#f0f0f0',
    FADE_TEXT: '#888888',
    WARNING: '#ffeb3b',
    ERROR: '#ff3d00'
  },
  SYMBOLS: {
    INCOMING: chalk.hex('#8a2be2')('🔮'),
    OUTGOING: chalk.hex('#e91e63')('🌌'),
    GROUP: '†',
    PRIVATE: '👤',
    MEDIA: '💾',
    COMMAND: '✨',
    SKULL: '💀',
    CROSS: '✟',
    DIVIDER: chalk.gray('~').repeat(40),
    CORNER: '✦'
  },
  GRADIENTS: {
    HEADER: gradient(['#8a2be2', '#e91e63']),
    BORDER: gradient(['#4b0082', '#8a2be2'])
  },
  FONTS: {
    MAIN: 'Georgia11',
    ALT: 'ANSI Shadow'
  }
};

const processingAnimations = new Map();

function getMessageType(message) {
  if (!message) return 'unknown';
  const type = Object.keys(message)[0];
  return type.replace('Message', '').toLowerCase() || 'text';
}

function getMessageContent(message) {
  return message?.conversation ||
         message?.extendedTextMessage?.text ||
         message?.imageMessage?.caption ||
         message?.videoMessage?.caption ||
         `${chalk.hex(GOTHIC_NEON_THEME.COLORS.SECONDARY_NEON)('<< GHOSTLY DATASTREAM >>')}`;
}

function startProcessingAnimation(messageId) {
  let frame = 0;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const interval = setInterval(() => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `${GOTHIC_NEON_THEME.GRADIENTS.HEADER(' Processing command... ')} ${chalk.hex(GOTHIC_NEON_THEME.COLORS.PRIMARY_NEON)(frames[frame])}`
    );
    frame = (frame + 1) % frames.length;
  }, 80);

  processingAnimations.set(messageId, interval);
}

function stopProcessingAnimation(messageId) {
  const interval = processingAnimations.get(messageId);
  if (interval) {
    clearInterval(interval);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    processingAnimations.delete(messageId);
  }
}

export async function terminalLogger(m, conn) {
  try {
    const { COLORS, SYMBOLS, GRADIENTS } = GOTHIC_NEON_THEME;
    const messageId = m.key.id;
    const messageContent = getMessageContent(m.message);
    const isCommand = messageContent?.trim().startsWith('.');

    if (isCommand) {
      startProcessingAnimation(messageId);
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      stopProcessingAnimation(messageId);
    }

    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const metadata = isGroup ? await conn.groupMetadata(m.key.remoteJid) : null;
    const groupName = isGroup ? metadata.subject : 'Private Chat';
    const senderJid = m.key.participant || m.key.remoteJid;
    const sender = jidDecode(senderJid)?.user || senderJid.split('@')[0];
    const msgType = getMessageType(m.message);
    const isFromMe = m.key.fromMe;
    const messageDirectionIcon = isFromMe ? SYMBOLS.OUTGOING : SYMBOLS.INCOMING;

    const datetime = new Date().toLocaleString();
    const groupId = isGroup ? m.key.remoteJid : 'N/A';

    const header = GRADIENTS.HEADER(
      `${SYMBOLS.CORNER} [ ${messageDirectionIcon} TERMINAL ECHO ] ${SYMBOLS.CORNER}`
    );

    const messageDetails =
      `${chalk.hex(COLORS.FADE_TEXT)(SYMBOLS.DIVIDER)}\n` +
      `${chalk.hex(COLORS.TEXT)(`Chat: ${isGroup ? SYMBOLS.GROUP : SYMBOLS.PRIVATE} ${groupName}`)}\n` +
      `${chalk.hex(COLORS.TEXT)(`From: ${sender}`)}\n` +
      `${chalk.hex(COLORS.TEXT)(`Type: ${msgType.toUpperCase()}`)}\n` +
      `${chalk.hex(COLORS.FADE_TEXT)(SYMBOLS.DIVIDER)}\n` +
      `${chalk.hex(COLORS.FADE_TEXT)(`ID: ${groupId}`)}\n` +
      `${chalk.hex(COLORS.FADE_TEXT)(`Timestamp: ${datetime}`)}\n\n` +
      `${chalk.hex(COLORS.PRIMARY_NEON)(messageContent)}\n`;

    console.log(
      header + '\n' +
      boxen(
        messageDetails,
        {
          padding: 1,
          margin: { top: 0, bottom: 1 },
          borderStyle: 'double',
          borderColor: isCommand ? COLORS.SECONDARY_NEON : COLORS.PRIMARY_NEON,
          backgroundColor: COLORS.BACKGROUND
        }
      )
    );

    if (process.env.DEBUG_MODE) {
      console.log(
        boxen(
          `${chalk.hex(COLORS.PRIMARY_NEON)(`${SYMBOLS.SKULL} ORACLE DIAGNOSTICS ${SYMBOLS.SKULL}`)}\n\n` +
          `${chalk.hex(COLORS.FADE_TEXT)(`Message ID: ${m.key.id}`)}\n` +
          `${chalk.hex(COLORS.FADE_TEXT)(`Remote JID: ${m.key.remoteJid}`)}\n` +
          `${chalk.hex(COLORS.FADE_TEXT)(`Timestamp: ${new Date(m.messageTimestamp * 1000).toLocaleString()}`)}`,
          {
            padding: 1,
            borderStyle: 'single',
            borderColor: COLORS.BACKGROUND,
            backgroundColor: '#1a0d2e'
          }
        )
      );
    }
  } catch (err) {
    console.log(
      boxen(
        `${chalk.hex(GOTHIC_NEON_THEME.COLORS.ERROR)(`${GOTHIC_NEON_THEME.SYMBOLS.CROSS} CURSED ERROR: ${GOTHIC_NEON_THEME.SYMBOLS.CROSS}`)}\n\n` +
        `${chalk.hex(GOTHIC_NEON_THEME.COLORS.TEXT)(err.stack || err.message)}`,
        {
          padding: 1,
          borderStyle: 'bold',
          borderColor: GOTHIC_NEON_THEME.COLORS.ERROR,
          backgroundColor: GOTHIC_NEON_THEME.COLORS.BACKGROUND
        }
      )
    );
  }
}

export function showStartupBanner(botName, version) {
  console.clear();
  const { COLORS, FONTS, SYMBOLS, GRADIENTS } = GOTHIC_NEON_THEME;

  console.log(
    boxen(
      GRADIENTS.HEADER(
        figlet.textSync(botName, {
          font: FONTS.MAIN,
          horizontalLayout: 'full'
        })
      ),
      {
        padding: 1,
        float: 'center',
        borderStyle: 'double',
        borderColor: COLORS.PRIMARY_NEON,
        backgroundColor: COLORS.BACKGROUND
      }
    )
  );

  console.log(
    boxen(
      `${GRADIENTS.HEADER(`// AWAITING THE ETERNAL SILENCE...`)}\n\n` +
      `${chalk.hex(COLORS.PRIMARY_NEON)(`${SYMBOLS.CROSS} Version:`)} ${chalk.hex(COLORS.TEXT)(version)}\n` +
      `${chalk.hex(COLORS.PRIMARY_NEON)(`${SYMBOLS.CROSS} Awakened at:`)} ${chalk.hex(COLORS.TEXT)(new Date().toLocaleString())}\n` +
      `\n${chalk.hex(COLORS.SECONDARY_NEON)('The Oracle is now listening.')}\n`,
      {
        padding: 1,
        borderStyle: 'singleDouble',
        borderColor: COLORS.SECONDARY_NEON,
        backgroundColor: COLORS.BACKGROUND
      }
    )
  );

  console.log(chalk.hex(COLORS.FADE_TEXT)(SYMBOLS.DIVIDER) + '\n');
}

export default {
  terminalLogger,
  showStartupBanner,
  theme: GOTHIC_NEON_THEME
};
