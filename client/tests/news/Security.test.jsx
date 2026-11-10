import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ArticleContent from '../../src/components/news/ArticleContent.jsx'

afterEach(cleanup)
it('mostra HTML de notícias como texto, inclusive na prévia administrativa', () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>'
  const { container } = render(<ArticleContent compact headingLevel="h2" post={{
    title: payload, content: payload, excerpt: payload, author: { name: payload }, category: { name: payload },
  }} />)
  expect(screen.getByRole('heading')).toHaveTextContent(payload)
  expect(container.querySelectorAll('script, img, iframe, svg')).toHaveLength(0)
  expect(container.querySelector('.portal-content-body')).toHaveTextContent(payload)
})
