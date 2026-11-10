const { rateLimit } = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Muitas tentativas. Tente novamente em 15 minutos.',
  },
})

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  skip: (req) => req.body?.currentPassword === undefined && req.body?.newPassword === undefined,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de alteração de senha. Tente novamente em 15 minutos.' },
})

module.exports = { authLimiter, passwordChangeLimiter }
