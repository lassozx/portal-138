const express = require('express')
const prisma = require('../config/prisma')
const { authenticateToken, authorizeRoles } = require('../middlewares/auth')

const router = express.Router()

/**
 * @swagger
 * /api/admin/posts:
 *   get:
 *     summary: Listar notícias de todos os status para o painel administrativo
 *     tags: [Notícias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 100
 *     responses:
 *       200:
 *         description: Lista paginada de notícias
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Apenas administradores e editores podem consultar a lista
 *       500:
 *         description: Erro interno
 */
router.get(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'EDITOR'),
  async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100))
      const skip = (page - 1) * limit

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            author: { select: { id: true, name: true } },
            category: true,
          },
        }),
        prisma.post.count(),
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
      console.error('Erro ao listar notícias administrativas:', error)
      return res.status(500).json({
        message: 'Erro interno ao listar notícias.',
      })
    }
  },
)

module.exports = router
