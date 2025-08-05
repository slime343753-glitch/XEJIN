import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import util from 'util'
import webpmux from 'node-webpmux'

const execAsync = util.promisify(exec)

export async function writeExif(mediaPath, options = {}) {
  const packname = options.packname || ''
  const author = options.author || ''
  const outPath = path.join(tmpdir(), `sticker_${Date.now()}.webp`)

  const sticker = new webpmux.Image()
  await sticker.load(mediaPath)

  const exifAttr = {
    'sticker-pack-id': 'com.jungkook.sticker',
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['🔥']
  }

  const jsonExif = Buffer.from(JSON.stringify(exifAttr), 'utf8')
  const exif = Buffer.concat([
    Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]), // TIFF header
    jsonExif
  ])

  sticker.exif = exif
  await sticker.save(outPath)
  return outPath
}