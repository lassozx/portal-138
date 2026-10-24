const express = require('express')
const prisma = require('../config/prisma')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')

const router = express.Router()

// Listar notícias publicadas com paginação, filtros e ordenação
router.get('/', async (req, res) => {
  try {
    const rawPage = req.query.page
    const rawLimit = req.query.limit

    const page = rawPage === undefined ? 1 : Number(rawPage)
    const limit = rawLimit === undefined ? 10 : Number(rawLimit)

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message:
          'A página deve ser um inteiro positivo e o limite deve ser um inteiro entre 1 e 100.',
      })
    }

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : ''

    const categoryId =
      typeof req.query.categoryId === 'string'
        ? req.query.categoryId.trim()
        : ''

    const sort =
      typeof req.query.sort === 'string'
        ? req.query.sort.trim().toLowerCase()
        : 'latest'

    if (!['latest', 'oldest'].includes(sort)) {
      return res.status(400).json({
        message: 'Ordenação inválida. Use "latest" ou "oldest".',
      })
    }

    const where = {
      status: 'PUBLISHED',
      publishedAt: {
        lte: new Date(),
      },
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      }
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const direction = sort === 'oldest' ? 'asc' : 'desc'

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
          category: true,
        },
        orderBy: [
          { publishedAt: direction },
          { createdAt: direction },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    return res.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erro ao listar notícias:', error.message)

    return res.status(500).json({
      message: 'Erro ao buscar notícias.',
    })
  }
})

// Buscar uma notícia publicada pelo slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const post = await prisma.post.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        publishedAt: {
          lte: new Date(),
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        category: true,
      },
    })

    if (!post) {
      return res.status(404).json({
        message: 'Notícia não encontrada.',
      })
    }

    return res.json(post)
  } catch (error) {
    console.error('Erro ao buscar notícia:', error.message)

    return res.status(500).json({
      message: 'Erro ao buscar notícia.',
    })
  }
})

// Criar notícia (somente ADMIN e EDITOR)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const { title, slug, excerpt, content, coverImage, categoryId } =
        req.body

      if (!title || !slug || !content) {
        return res.status(400).json({
          message: 'Título, slug e conteúdo são obrigatórios.',
        })
      }

      const existingPost = await prisma.post.findUnique({
        where: { slug },
      })

      if (existingPost) {
        return res.status(409).json({
          message: 'Já existe uma notícia com esse slug.',
        })
      }

      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        })

        if (!category) {
          return res.status(400).json({
            message: 'A categoria informada não existe.',
          })
        }
      }

      const post = await prisma.post.create({
        data: {
          title,
          slug,
          excerpt: excerpt || null,
          content,
          coverImage: coverImage || null,
          status: 'DRAFT',
          authorId: req.user.id,
          categoryId: categoryId || null,
        },
      })

      return res.status(201).json({
        message: 'Notícia criada como rascunho.',
        post,
      })
    } catch (error) {
      console.error('Erro ao criar notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao criar notícia.',
      })
    }
  }
)

// Editar notícia (somente ADMIN e EDITOR)
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const { id } = req.params
      const {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        categoryId,
        status,
      } = req.body

      const existingPost = await prisma.post.findUnique({
        where: { id },
      })

      if (!existingPost) {
        return res.status(404).json({
          message: 'Notícia não encontrada.',
        })
      }

      const data = {}

      if (title !== undefined) data.title = title
      if (slug !== undefined) data.slug = slug
      if (excerpt !== undefined) data.excerpt = excerpt
      if (content !== undefined) data.content = content
      if (coverImage !== undefined) data.coverImage = coverImage
      if (categoryId !== undefined) data.categoryId = categoryId || null

      if (status !== undefined) {
        const allowedStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

        if (!allowedStatuses.includes(status)) {
          return res.status(400).json({
            message: 'Status inválido.',
          })
        }

        data.status = status
        data.publishedAt =
          status === 'PUBLISHED'
            ? existingPost.publishedAt || new Date()
            : null
      }

      if (data.slug) {
        const slugInUse = await prisma.post.findFirst({
          where: {
            slug: data.slug,
            NOT: { id },
          },
        })

        if (slugInUse) {
          return res.status(409).json({
            message: 'Esse slug já está sendo usado por outra notícia.',
          })
        }
      }

      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        })

        if (!category) {
          return res.status(400).json({
            message: 'A categoria informada não existe.',
          })
        }
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data,
      })

      return res.json({
        message: 'Notícia atualizada com sucesso.',
        post: updatedPost,
      })
    } catch (error) {
      console.error('Erro ao editar notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao editar notícia.',
      })
    }
  }
)

// Excluir notícia (somente ADMIN)
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params

      const existingPost = await prisma.post.findUnique({
        where: { id },
      })

      if (!existingPost) {
        return res.status(404).json({
          message: 'Notícia não encontrada.',
        })
      }

      await prisma.post.delete({
        where: { id },
      })

      return res.json({
        message: 'Notícia excluída com sucesso.',
      })
    } catch (error) {
      console.error('Erro ao excluir notícia:', error.message)

      return res.status(500).json({
        message: 'Erro interno ao excluir notícia.',
      })
    }
  }
)

module.exports = router