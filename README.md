# Portal 138

Portal de notícias da comunidade escolar SESI 138, criado e desenvolvido por
**Lasso, estudante do SENAI**.

O projeto reúne notícias, busca, categorias, comentários, contas de usuário e
painel administrativo, com upload de capas e gestão de usuários e permissões.
O cliente usa React, Vite e Tailwind CSS; a API usa Node.js, Express, Prisma e
PostgreSQL.

## Documentação

- [Instalação e execução local](docs/installation.md): requisitos, banco,
  variáveis de ambiente e criação do primeiro administrador.
- [Painel administrativo](docs/administration.md): imagens, usuários,
  permissões, armazenamento e endpoints.
- [Produção e backups](docs/production.md): execução sem Vite, variáveis de ambiente,
  persistência e procedimentos de cópia e restauração.
- [Hospedagem gratuita](docs/hosting-free.md): Render com PostgreSQL e imagens no Supabase.
- [Segurança](docs/security.md): proteções, testes da revisão e limites antes da publicação.
- [Desenvolvimento](docs/development.md): testes, build, CI, estrutura do código
  e configuração fora do ambiente local.

## Estrutura do projeto

```text
portal-138/
├── .github/workflows/       # Integração contínua
├── client/
│   ├── public/              # Favicon e imagens fixas
│   │   └── images/
│   ├── src/
│   │   ├── app/             # Composição e navegação
│   │   ├── components/      # Componentes por contexto
│   │   ├── hooks/           # Hooks React
│   │   ├── pages/           # Telas do portal
│   │   ├── styles/          # CSS global
│   │   ├── utils/           # Funções auxiliares
│   │   └── main.jsx         # Entrada do React
│   └── tests/               # Testes do cliente por contexto
├── docs/                    # Guias do projeto
├── server/
│   ├── prisma/              # Schema e migrações do banco
│   ├── scripts/             # Utilitários administrativos
│   ├── src/
│   │   ├── config/
│   │   ├── middlewares/
│   │   └── routes/
│   ├── tests/
│   │   ├── integration/     # Testes com PostgreSQL
│   │   └── unit/            # Rotas e middlewares com dependências simuladas
│   └── uploads/             # Imagens enviadas; fora do Git
├── docker-compose.yml       # PostgreSQL local
└── README.md
```

Os arquivos de configuração de cada ferramenta ficam junto ao pacote que os
utiliza: `client/vite.config.js`, `server/prisma.config.ts` e os respectivos
`package.json`. Dependências, builds, segredos e arquivos enviados não são
versionados.

## Iniciar durante o desenvolvimento

Após seguir o [guia de instalação](docs/installation.md), execute na raiz, em
terminais separados:

```sh
npm --prefix server run dev
```

```sh
npm --prefix client run dev
```

Abra `http://localhost:5173`. A API usa `http://localhost:3000`, com documentação
interativa em `http://localhost:3000/api-docs`.

## Conferir a versão compilada

Pare a API de desenvolvimento para liberar a porta 3000 e execute na raiz:

```sh
npm --prefix client run build
npm --prefix server run start:prod
```

Abra `http://localhost:3000`. Veja o [guia de produção](docs/production.md) antes
de configurar uma hospedagem.
