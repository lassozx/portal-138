export function passwordValidationMessage(password, minimum = 8) {
  if (password.length < minimum) return `A senha precisa ter pelo menos ${minimum} caracteres.`
  if (new TextEncoder().encode(password).byteLength > 72) {
    return 'A senha é muito longa. Use menos caracteres, especialmente acentos e emojis.'
  }
  return ''
}
