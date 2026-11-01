import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PortalFooter, PortalHeader } from '../PortalChrome.jsx'

afterEach(cleanup)

it('abre o menu e devolve o foco ao botão ao fechar com Escape', () => {
  render(<PortalHeader />)
  const button = screen.getByRole('button', { name: 'Abrir menu' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveAttribute('id', button.getAttribute('aria-controls'))

  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  screen.getByRole('link', { name: 'Notícias' }).focus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(button).toHaveFocus()
})

it('fecha o menu ao navegar e apresenta uma única ação de conta', () => {
  render(<><PortalHeader active="news" onLogin={vi.fn()} /><PortalFooter /></>)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
  fireEvent.click(screen.getByRole('link', { name: 'Notícias' }))
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('link', { name: 'Notícias' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('button', { name: 'Entrar', exact: true })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Pesquisar notícias' })).toHaveAttribute('href', '#noticias')
})

it('encaminha a pesquisa ao campo da página e fecha o menu', () => {
  const onSearch = vi.fn()
  render(<PortalHeader onSearch={onSearch} />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pesquisar notícias' }))
  expect(onSearch).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
})
