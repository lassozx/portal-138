function errorHandler(err, req, res, next) {
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
