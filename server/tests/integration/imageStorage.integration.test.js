const http = require('node:http')
const { createImageStorage } = require('../../src/services/imageStorage')

it('envia o protocolo HTTP binário correto para um servidor de armazenamento simulado', async () => {
  const received = []
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      received.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks) })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"Key":"portal-capas/file.png"}')
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    const storage = createImageStorage({ provider: 'supabase', origin, secretKey: 'sb_secret_test_only', bucket: 'portal-capas' })
    const filename = '00000000-0000-0000-0000-000000000000.png'
    const body = Buffer.from([0, 1, 2, 255])
    expect(await storage.save(body, 'image/png', filename)).toBe(`${origin}/storage/v1/object/public/portal-capas/${filename}`)
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ method: 'POST', url: `/storage/v1/object/portal-capas/${filename}`, headers: { apikey: 'sb_secret_test_only', 'content-type': 'image/png', 'x-upsert': 'false' }, body })
    expect(received[0].headers).not.toHaveProperty('authorization')
    await expect(storage.save(body, 'image/png', '../private.png')).rejects.toThrow('Nome de imagem inválido.')
    expect(received).toHaveLength(1)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
