import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// The imagegen masters are kept outside public/ so visitors download only optimized assets.
// Run with: node scripts/build-brand-assets.mjs
const root = fileURLToPath(new URL('../', import.meta.url))
const source = (name) => resolve(root, 'src/assets/brand', name)
const destination = (name) => resolve(root, name)

async function saveImage(input, path, width, height, format = 'png') {
  const target = destination(path)
  await mkdir(dirname(target), { recursive: true })
  await sharp(input)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toFormat(format, format === 'webp' ? { quality: 88 } : { compressionLevel: 9 })
    .toFile(target)
  console.log(`${path}: ${width}x${height}`)
}

async function saveIco(input) {
  const sizes = [16, 32, 48, 64, 128, 256]
  const frames = await Promise.all(
    sizes.map((size) => sharp(input).resize(size, size).png().toBuffer())
  )
  const header = Buffer.alloc(6 + frames.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length

  for (const [index, frame] of frames.entries()) {
    const entry = 6 + index * 16
    header[entry] = sizes[index] === 256 ? 0 : sizes[index]
    header[entry + 1] = header[entry]
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(frame.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += frame.length
  }

  await writeFile(destination('public/favicon/favicon.ico'), Buffer.concat([header, ...frames]))
  console.log('public/favicon/favicon.ico: 16, 32, 48, 64, 128, 256px')
}

const avatar = await readFile(source('avatar-master.png'))
const icon = await readFile(source('icon-master.png'))
const social = await readFile(source('social-card-master.png'))

await saveImage(avatar, 'src/assets/avatar-brand.webp', 512, 512, 'webp')
await saveImage(avatar, 'public/images/avatar.png', 512, 512)

for (const [name, size] of [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512]
]) {
  await saveImage(icon, `public/favicon/${name}`, size, size)
}

await saveIco(icon)
await saveImage(social, 'public/images/social-card.png', 1200, 630)
