const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

async function authenticateToken(req, res, next) {
const authorization = req.headers.authorization

if (!authorization || !authorization.startsWith('Bearer ')) {
return res.status(401).json({
message: 'Token de autenticação não informado.',
})
}

const token = authorization.split(' ')[1]

try {
const decoded = jwt.verify(token, process.env.JWT_SECRET)

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

next()

} catch (error) {
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

next()

}
}

module.exports = {
authenticateToken,
authorizeRoles,
}
