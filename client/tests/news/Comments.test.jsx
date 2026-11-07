import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Comments from '../../src/components/news/Comments.jsx'

const postId = 'post-123'

const comment = {
  id: 'comment-1',
  content: 'Comentário de teste',
  createdAt: '2026-10-22T12:00:00.000Z',
  author: {
    id: 'user-1',
    name: 'Usuário Teste',
  },
}

function createSession(role = 'USER', id = 'user-1') {
  return {
    token: 'token-teste',
    user: {
      id,
      role,
      name: 'Usuário Teste',
    },
  }
}

function paginatedResponse(comments = [], page = 1, total = comments.length) {
  return {
    comments,
    pagination: {
      page,
      limit: 10,
      total,
      totalPages: Math.ceil(total / 10),
    },
  }
}

function mockFetch(responses) {
  global.fetch = vi.fn()

  responses.forEach((response) => {
    global.fetch.mockResolvedValueOnce({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body,
    })
  })

  return global.fetch
}

describe('Comments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('carrega e exibe os comentários', async () => {
    mockFetch([{ body: paginatedResponse([comment]) }])

    render(<Comments postId={postId} session={null} />)

    expect(await screen.findByText('Comentário de teste')).toBeInTheDocument()
    expect(screen.getByText('Usuário Teste')).toBeInTheDocument()
    expect(screen.getByText('Comentários (1)')).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/comments/post/${postId}?page=1`,
    )
  })

  it('carrega mais comentários ao clicar no botão', async () => {
    const secondComment = {
      ...comment,
      id: 'comment-2',
      content: 'Comentário da segunda página',
      author: {
        id: 'user-2',
        name: 'Outro Usuário',
      },
    }

    const fetchMock = mockFetch([
      {
        body: paginatedResponse([comment], 1, 11),
      },
      {
        body: paginatedResponse([secondComment], 2, 11),
      },
    ])

    render(<Comments postId={postId} session={null} />)

    expect(await screen.findByText('Comentário de teste')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Carregar mais comentários' }),
    )

    expect(
      await screen.findByText('Comentário da segunda página'),
    ).toBeInTheDocument()

    expect(screen.getByText('Comentário de teste')).toBeInTheDocument()
    expect(screen.getByText('Comentários (11)')).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/comments/post/${postId}?page=2`,
    )

    expect(
      screen.queryByRole('button', { name: 'Carregar mais comentários' }),
    ).not.toBeInTheDocument()
  })

  it('permite publicar um comentário autenticado', async () => {
    const newComment = {
      ...comment,
      id: 'comment-2',
      content: 'Meu novo comentário',
    }

    const fetchMock = mockFetch([
      {
        body: paginatedResponse([], 1, 0),
      },
      {
        status: 201,
        body: {
          message: 'Comentário criado.',
          comment: newComment,
        },
      },
      {
        body: paginatedResponse([newComment], 1, 1),
      },
    ])

    render(<Comments postId={postId} session={createSession()} />)

    const textarea = await screen.findByLabelText('Escreva um comentário')

    fireEvent.change(textarea, {
      target: { value: '  Meu novo comentário  ' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(await screen.findByText('Meu novo comentário')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Comentário publicado com sucesso.',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/comments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-teste',
        }),
        body: JSON.stringify({
          content: 'Meu novo comentário',
          postId,
        }),
      }),
    )
  })

  it('não publica um comentário vazio', async () => {
    mockFetch([
      {
        body: paginatedResponse([], 1, 0),
      },
    ])

    render(<Comments postId={postId} session={createSession()} />)

    await screen.findByLabelText('Escreva um comentário')

    fireEvent.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O comentário não pode estar vazio.',
    )
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('mostra uma mensagem quando a API falha ao carregar comentários', async () => {
    mockFetch([
      {
        ok: false,
        status: 500,
        body: { message: 'Falha ao carregar comentários.' },
      },
    ])

    render(<Comments postId={postId} session={null} />)

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Falha ao carregar comentários.')
  })

  it('permite que o autor exclua o próprio comentário', async () => {
    const fetchMock = mockFetch([
      {
        body: paginatedResponse([comment]),
      },
      {
        body: { message: 'Comentário excluído.' },
      },
      {
        body: paginatedResponse([]),
      },
    ])

    render(<Comments postId={postId} session={createSession()} />)

    const deleteButton = await screen.findByRole('button', {
      name: 'Excluir comentário de Usuário Teste',
    })

    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.queryByText('Comentário de teste')).not.toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/comments/comment-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer token-teste',
        },
      }),
    )
  })

  it('não mostra o botão de exclusão para outro usuário', async () => {
    mockFetch([
      {
        body: paginatedResponse([comment]),
      },
    ])

    render(
      <Comments
        postId={postId}
        session={createSession('USER', 'outro-usuario')}
      />,
    )

    await screen.findByText('Comentário de teste')

    expect(
      screen.queryByRole('button', {
        name: 'Excluir comentário de Usuário Teste',
      }),
    ).not.toBeInTheDocument()
  })

  it('permite que um administrador exclua comentários de outros usuários', async () => {
    mockFetch([
      {
        body: paginatedResponse([comment]),
      },
    ])

    render(
      <Comments
        postId={postId}
        session={createSession('ADMIN', 'admin-1')}
      />,
    )

    expect(
      await screen.findByRole('button', {
        name: 'Excluir comentário de Usuário Teste',
      }),
    ).toBeInTheDocument()
  })
})
