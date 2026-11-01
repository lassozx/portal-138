export function passwordValidationMessage(password) {
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (new TextEncoder().encode(password).byteLength > 72) {
    return 'A senha é muito longa. Use menos caracteres, especialmente acentos e emojis.'
  }
  return ''
}
