const { mkdir, writeFile } = require('node:fs/promises')
const path = require('node:path')

function createImageStorage(config, fetchImpl = (...args) => fetch(...args)) {
  return {
    async save(buffer, type, filename) {
      if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)) {
        throw new Error('Nome de imagem inválido.')
      }
      if (config.provider === 'local') {
        await mkdir(config.directory, { recursive: true })
        await writeFile(path.join(config.directory, filename), buffer, { flag: 'wx', mode: 0o644 })
        return `/api/uploads/${filename}`
      }

      // Only the server receives this key. Do not follow redirects with it.
      try {
        const response = await fetchImpl(`${config.origin}/storage/v1/object/${config.bucket}/${filename}`, {
          method: 'POST',
          headers: {
            apikey: config.secretKey,
            'Content-Type': type,
            'Cache-Control': 'max-age=31536000',
            'x-upsert': 'false',
          },
          body: buffer,
          signal: AbortSignal.timeout(30000),
          redirect: 'error',
        })
        await response.body?.cancel()
        if (!response.ok) throw new Error('Storage request failed')
        return `${config.origin}/storage/v1/object/public/${config.bucket}/${filename}`
      } catch {
        // Provider errors can include credentials. Keep logs and API responses generic.
        throw Object.assign(new Error('Não foi possível salvar a imagem no armazenamento externo. Tente novamente.'), { statusCode: 502 })
      }
    },
  }
}

module.exports = { createImageStorage }
