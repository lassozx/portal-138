const { X509Certificate } = require('node:crypto')
const { mkdtempSync, writeFileSync } = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function readDatabaseConfig(source) {
  if (!source.DATABASE_URL) throw new Error('A variável DATABASE_URL não foi definida.')
  const ca = source.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim()
  if (ca) {
    try { if (!new X509Certificate(ca).ca) throw new Error() } catch {
      throw new Error('DATABASE_SSL_CA deve conter um certificado de autoridade em formato PEM válido.')
    }
  }
  return { connectionString: source.DATABASE_URL, ca }
}

function withoutSslParameters(connectionString) {
  let url
  try {
    url = new URL(connectionString)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error()
  } catch { throw new Error('DATABASE_URL inválida para configurar TLS.') }
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('ssl') || key === 'uselibpqcompat') url.searchParams.delete(key)
  }
  return url
}

function getDatabaseOptions(source = process.env) {
  const { connectionString, ca } = readDatabaseConfig(source)
  if (!ca) return { connectionString }
  // pg's URL SSL parameters would overwrite the explicit CA options.
  return { connectionString: withoutSslParameters(connectionString).toString(), ssl: { ca, rejectUnauthorized: true } }
}

function getPrismaConnectionString(source = process.env) {
  const { connectionString, ca } = readDatabaseConfig(source)
  if (!ca) return connectionString
  // Prisma's migration engine uses different certificate parameters from pg.
  const directory = mkdtempSync(path.join(os.tmpdir(), 'portal138-ca-'))
  const certificate = path.join(directory, 'root.crt')
  writeFileSync(certificate, ca, { mode: 0o600 })
  const url = withoutSslParameters(connectionString)
  url.searchParams.set('sslmode', 'require')
  url.searchParams.set('sslaccept', 'strict')
  url.searchParams.set('sslcert', certificate)
  return url.toString()
}

module.exports = { getDatabaseOptions, getPrismaConnectionString }
