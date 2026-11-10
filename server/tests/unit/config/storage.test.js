const { getStorageConfig } = require('../../../src/config/storage')
const remote = { UPLOAD_STORAGE: 'supabase', SUPABASE_URL: 'https://portal-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only_2026' }

it('mantém armazenamento local por padrão e resolve a pasta a partir de server', () => {
  expect(getStorageConfig({})).toEqual({ provider: 'local', directory: expect.stringMatching(/\/server\/uploads$/) })
  expect(getStorageConfig({ UPLOAD_DIR: '/tmp/portal-images' }).directory).toBe('/tmp/portal-images')
})
it('valida a origem e exige uma chave secreta para armazenamento Supabase', () => {
  expect(getStorageConfig(remote)).toEqual({ provider: 'supabase', origin: remote.SUPABASE_URL, secretKey: remote.SUPABASE_SECRET_KEY, bucket: 'portal-capas' })
})
it.each([
  { UPLOAD_STORAGE: 'invalid' },
  { SUPABASE_URL: '' },
  { SUPABASE_URL: 'http://portal-test.supabase.co' },
  { SUPABASE_URL: 'https://attacker.example' },
  { SUPABASE_URL: 'https://portal-test.supabase.co.attacker.example' },
  { SUPABASE_URL: 'https://user:password@portal-test.supabase.co' },
  { SUPABASE_URL: 'https://portal-test.supabase.co/storage' },
  { SUPABASE_URL: 'https://portal-test.supabase.co?key=x' },
  { SUPABASE_URL: 'https://portal-test.supabase.co:8443' },
  { SUPABASE_SECRET_KEY: 'sb_publishable_test_key' },
  { SUPABASE_SECRET_KEY: '' },
  { SUPABASE_STORAGE_BUCKET: '../other' },
])('rejeita configuração inválida sem incluir o segredo na mensagem (%j)', override => {
  let error
  try { getStorageConfig({ ...remote, ...override }) } catch (caught) { error = caught }
  expect(error).toBeInstanceOf(Error)
  expect(error.message).not.toContain(remote.SUPABASE_SECRET_KEY)
})
