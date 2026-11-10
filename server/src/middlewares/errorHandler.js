function errorHandler(err, req, res, next) {
// JSON parser messages can include fragments of credentials from the request.
if (err.type === 'entity.parse.failed') {
  return res.status(400).json({ status: 'error', message: 'JSON inválido na requisição.' })
}
console.error('Erro na aplicação:', {
message: err.message,
method: req.method,
path: req.originalUrl,
})

if (res.headersSent) {
return next(err)
}

const statusCode =
Number.isInteger(err.statusCode) &&
err.statusCode >= 400 &&
err.statusCode <= 599
? err.statusCode
: 500

const message =
statusCode === 500
? 'Erro interno do servidor.'
: err.message || 'Ocorreu um erro na requisição.'

return res.status(statusCode).json({
status: 'error',
message,
})
}

module.exports = errorHandler
