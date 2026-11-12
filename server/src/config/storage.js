const path = require('node:path')

function getStorageConfig(source = process.env) {
  const provider = source.UPLOAD_STORAGE || 'local'
  if (!['local', 'supabase'].includes(provider)) {
    throw new Error('UPLOAD_STORAGE deve ser local ou supabase.')
  }
  if (provider === 'local') {
    return { provider, directory: path.resolve(__dirname, '../..', source.UPLOAD_DIR || 'uploads') }
  }

  let url
  try { url = new URL(source.SUPABASE_URL) } catch {
    throw new Error('Configure SUPABASE_URL com a origem HTTPS do seu projeto Supabase.')
  }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_URL deve ser uma origem HTTPS de projeto em supabase.co, sem caminho ou credenciais.')
  }
  const secretKey = source.SUPABASE_SECRET_KEY
  if (typeof secretKey !== 'string' || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) {
    throw new Error('Configure SUPABASE_SECRET_KEY com uma chave secreta sb_secret_ do servidor.')
  }
  const bucket = source.SUPABASE_STORAGE_BUCKET || 'portal-capas'
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('SUPABASE_STORAGE_BUCKET deve conter de 2 a 63 letras minúsculas, números ou hífens.')
  }
  return { provider, origin: url.origin, secretKey, bucket }
}

module.exports = { getStorageConfig }
