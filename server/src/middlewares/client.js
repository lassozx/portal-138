const express = require('express')
const path = require('node:path')
const { accessSync, constants } = require('node:fs')

function createClientRouter(directory) {
  const indexFile = path.join(directory, 'index.html')
  try { accessSync(indexFile, constants.R_OK) } catch {
    throw new Error('Build do cliente não encontrado. Execute npm --prefix client run build na raiz do projeto antes de iniciar em produção.')
  }
  const router = express.Router()
  const options = { index: false, redirect: false, dotfiles: 'deny' }
  router.use('/assets', express.static(path.join(directory, 'assets'), {
    ...options,
    immutable: true,
    maxAge: '1y',
  }))
  router.use(express.static(directory, {
    ...options,
    maxAge: 0,
    setHeaders: (res, file) => {
      if (path.extname(file) === '.html') res.set('Cache-Control', 'no-cache')
    },
  }))
  // Navigation uses hashes (/#/noticias/slug), so only / needs the HTML shell.
  // Missing assets and unknown API endpoints must keep their real 404 responses.
  router.get('/', (req, res, next) => {
    res.set('Cache-Control', 'no-cache')
    res.sendFile(indexFile, error => { if (error) next(error) })
  })
  return router
}

module.exports = { createClientRouter }
