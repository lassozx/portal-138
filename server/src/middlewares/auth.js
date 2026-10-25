const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

async function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({
      message: 'Token de autenticação não informado.',
    })
  }

  const token = authorization.split(/\s+/)[1]

  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET não está configurado.')
      return res.status(500).json({
        message: 'Erro interno de autenticação.',
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })

    if (!decoded || typeof decoded.userId !== 'string') {
      return res.status(401).json({
        message: 'Token inválido ou expirado.',
      })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        message: 'Usuário não encontrado.',
      })
    }

    req.user = user
    return next()
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' &&
        error.name !== 'TokenExpiredError' &&
        error.name !== 'NotBeforeError') {
      console.error('Erro ao autenticar usuário:', error.message)

      return res.status(500).json({
        message: 'Erro interno de autenticação.',
      })
    }

    return res.status(401).json({
      message: 'Token inválido ou expirado.',
    })
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Você não tem permissão para realizar esta ação.',
      })
    }

    return next()
  }
}

module.exports = {
  authenticateToken,
  authorizeRoles,
}
