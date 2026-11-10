const express = require('express')
const { randomUUID } = require('node:crypto')
const { rateLimit } = require('express-rate-limit')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')
const { getStorageConfig } = require('../config/storage')
const { createImageStorage } = require('../services/imageStorage')

const router = express.Router()
const MAX_BYTES = 5 * 1024 * 1024
const storageConfig = getStorageConfig()
const storage = createImageStorage(storageConfig)
const imageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Limite de imagens atingido. Tente novamente mais tarde.' },
})

function matchesImage(buffer, type) {
  if (!Buffer.isBuffer(buffer)) return false
  if (type === 'image/jpeg') {
    return buffer.length >= 4 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
      buffer.subarray(-2).equals(Buffer.from([255, 217]))
  }
  if (type === 'image/png') {
    return buffer.length >= 45 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.toString('ascii', 12, 16) === 'IHDR' &&
      buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0 &&
      buffer.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))
  }
  if (type === 'image/webp') {
    return buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)) &&
      buffer.readUInt32LE(4) === buffer.length - 8
  }
  return false
}

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'EDITOR'), uploadLimiter,
  (req, res, next) => {
    const type = req.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    if (!imageTypes[type]) return res.status(415).json({ message: 'Escolha uma imagem JPG, PNG ou WebP.' })
    req.imageType = type
    next()
  },
  express.raw({ type: () => true, limit: MAX_BYTES, inflate: false }),
  async (req, res, next) => {
    if (!matchesImage(req.body, req.imageType)) {
      return res.status(400).json({ message: 'Arquivo inválido. Escolha uma imagem JPG, PNG ou WebP válida.' })
    }
    try {
      const filename = `${randomUUID()}.${imageTypes[req.imageType]}`
      const url = await storage.save(req.body, req.imageType, filename)
      res.status(201).json({ message: 'Imagem enviada com sucesso.', url })
    } catch (error) { next(error) }
  },
)

router.get('/:filename', (req, res, next) => {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(req.params.filename)) {
    return res.status(404).json({ message: 'Imagem não encontrada.' })
  }
  if (storageConfig.provider !== 'local') return res.status(404).json({ message: 'Imagem não encontrada.' })
  res.sendFile(req.params.filename, {
    root: storageConfig.directory,
    dotfiles: 'deny',
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  }, (error) => {
    if (!error) return
    if (error.status === 404) return res.status(404).json({ message: 'Imagem não encontrada.' })
    next(error)
  })
})

router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'A imagem deve ter no máximo 5 MB.' })
  next(error)
})

module.exports = router
