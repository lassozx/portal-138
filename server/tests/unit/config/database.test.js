const fs = require('node:fs')
const path = require('node:path')
const { getDatabaseOptions, getPrismaConnectionString } = require('../../../src/config/database')
const { Client } = require('pg')
const ca = fs.readFileSync(path.join(__dirname, '../../fixtures/database-ca.pem'), 'utf8').trim()
const connectionString = 'postgresql://test:test@localhost:5432/portal138'

it('preserva a conexão local e exige uma URL de banco', () => {
  expect(getDatabaseOptions({ DATABASE_URL: connectionString })).toEqual({ connectionString })
  expect(getPrismaConnectionString({ DATABASE_URL: connectionString })).toBe(connectionString)
  expect(() => getDatabaseOptions({})).toThrow('DATABASE_URL')
})
it('mantém a CA e a verificação TLS mesmo quando a URL contém parâmetros que sobrescreveriam ssl', () => {
  const options = getDatabaseOptions({ DATABASE_URL: `${connectionString}?sslmode=disable&sslrootcert=/wrong&uselibpqcompat=true`, DATABASE_SSL_CA: ca.replace(/\n/g, '\\n') })
  expect(options.ssl).toEqual({ ca, rejectUnauthorized: true })
  const client = new Client(options)
  expect(client.connectionParameters.ssl).toEqual({ ca, rejectUnauthorized: true })
  expect(new URL(options.connectionString).searchParams.has('sslmode')).toBe(false)
})
it('gera parâmetros de certificado próprios do Prisma sem perder verificação estrita', () => {
  const url = new URL(getPrismaConnectionString({ DATABASE_URL: `${connectionString}?schema=public&sslmode=disable`, DATABASE_SSL_CA: ca }))
  const certificate = url.searchParams.get('sslcert')
  try {
    expect(url.searchParams.get('schema')).toBe('public')
    expect(url.searchParams.get('sslmode')).toBe('require')
    expect(url.searchParams.get('sslaccept')).toBe('strict')
    expect(fs.readFileSync(certificate, 'utf8')).toBe(ca)
    expect(fs.statSync(certificate).mode & 0o777).toBe(0o600)
  } finally { fs.rmSync(path.dirname(certificate), { recursive: true }) }
})
it('rejeita certificado inválido sem incluir seu conteúdo na mensagem', () => {
  expect(() => getDatabaseOptions({ DATABASE_URL: connectionString, DATABASE_SSL_CA: 'invalid-sensitive-input' })).toThrow('certificado de autoridade')
  try { getPrismaConnectionString({ DATABASE_URL: connectionString, DATABASE_SSL_CA: 'invalid-sensitive-input' }) }
  catch (error) { expect(error.message).not.toContain('invalid-sensitive-input') }
  expect(() => getDatabaseOptions({ DATABASE_URL: 'invalid-connection-with-sensitive-data', DATABASE_SSL_CA: ca })).toThrow('DATABASE_URL inválida para configurar TLS.')
})
