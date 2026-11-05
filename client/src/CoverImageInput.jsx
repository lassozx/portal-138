import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

export default function CoverImageInput({ token, value, onChange, onBusyChange, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(null)

  useEffect(() => () => {
    pending.current?.abort()
    onBusyChange(false)
  }, [onBusyChange])

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!imageTypes.includes(file.type)) { setError('Escolha uma imagem JPG, PNG ou WebP.'); return }
    if (file.size > MAX_BYTES) { setError('A imagem deve ter no máximo 5 MB.'); return }
    if (!file.size) { setError('O arquivo está vazio. Escolha outra imagem.'); return }
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setUploading(true)
    onBusyChange(true)
    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
        body: file,
        signal: controller.signal,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Não foi possível enviar a imagem.')
      if (!controller.signal.aborted) onChange(result.url)
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'Não foi possível enviar a imagem.')
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setUploading(false)
        onBusyChange(false)
      }
    }
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-neutral-200 p-4" disabled={disabled || uploading}>
      <legend className="px-1 text-sm font-semibold text-neutral-700">Imagem de capa</legend>
      <label className="block text-sm font-semibold text-neutral-700">
        Enviar imagem de capa
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}
          aria-describedby="cover-image-help" className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-red-50 file:px-3 file:py-2 file:font-semibold file:text-red-700" />
      </label>
      <p id="cover-image-help" className="text-xs text-neutral-500">JPG, PNG ou WebP, até 5 MB. A imagem será vinculada ao salvar a notícia.</p>
      {uploading && <p role="status" className="text-sm text-neutral-600">Enviando imagem...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {value && (
        <div className="space-y-2">
          <img src={value} alt="Prévia da imagem de capa" className="max-h-52 w-full rounded object-contain bg-neutral-50" />
          <button type="button" onClick={() => onChange('')} className="text-sm font-semibold text-red-700">Remover imagem de capa</button>
        </div>
      )}
      <label className="block text-sm font-semibold text-neutral-700">
        URL da imagem de capa
        <input type="url" value={value.startsWith('/api/uploads/') ? '' : value}
          onChange={(event) => onChange(event.target.value)} placeholder="Ou cole um endereço https://..."
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-red-700" />
      </label>
    </fieldset>
  )
}
