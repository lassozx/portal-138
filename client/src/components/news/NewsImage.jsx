import { useState } from 'react'
import PortalIllustration from '../ui/PortalIllustration.jsx'

export default function NewsImage({ src, hero = false }) {
  const [failed, setFailed] = useState(false)
  return src && !failed ? (
    <img
      src={src}
      alt=""
      width="1600"
      height="1000"
      loading={hero ? 'eager' : 'lazy'}
      fetchPriority={hero ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  ) : (
    <PortalIllustration compact={!hero} />
  )
}
