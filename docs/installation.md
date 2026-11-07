# Instalação e execução

[Voltar ao início](../README.md)

## Pré-requisitos

- Node.js 24 LTS e npm.
- Docker com Docker Compose, para executar o PostgreSQL 18 localmente.
- Git.

## Instalação local

Clone o repositório e entre na pasta:

```sh
git clone https://github.com/lassozx/portal-138.git
cd portal-138
```

Na raiz do projeto, instale as dependências e inicie o banco:

```sh
npm --prefix server ci
npm --prefix client ci
docker compose up -d postgres
```

O banco usa a porta **5433** no computador e 5432 dentro do contêiner. Os dados
ficam no volume `portal138_data` entre reinicializações.

Copie a configuração de exemplo:

```sh
cp server/.env.example server/.env
```

A `DATABASE_URL` do exemplo já corresponde ao banco do Compose. Preencha
`JWT_SECRET` em `server/.env` com um segredo aleatório de pelo menos 32 caracteres.
Para gerar um valor, execute:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `JWT_SECRET`. O exemplo deixa esse campo vazio para exigir
a configuração de um segredo próprio. `JWT_EXPIRES_IN` define a duração da sessão
e usa `1h` por padrão; `PORT` define a porta da API e usa 3000 por padrão.

Gere o cliente Prisma e aplique as migrações, executando na pasta `server`:

```sh
cd server
npx prisma generate
npx prisma migrate deploy
```

Com o banco disponível, crie o primeiro administrador em um terminal interativo:

```sh
node scripts/create-admin.js
```

O script pede nome, e-mail e senha sem exibi-la. Use uma senha com pelo menos
12 caracteres e no máximo 72 bytes em UTF-8; acentos e emojis ocupam mais de um
byte. O cadastro público cria contas da comunidade, com perfil `USER`.

## Executar

Em um terminal na raiz do projeto, inicie a API:

```sh
npm --prefix server run dev
```

Em outro terminal na raiz, inicie o cliente:

```sh
npm --prefix client run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.
A API escuta em `http://localhost:3000`. O cliente encaminha as requisições `/api`
para essa porta durante o desenvolvimento; se mudar a porta da API, ajuste
`client/vite.config.js`.

- Documentação interativa: `http://localhost:3000/api-docs`.
- Saúde da API: `http://localhost:3000/api/health`.
- Conexão com o banco: `http://localhost:3000/api/health/database`.

Entre com a conta de administrador para acessar o painel e publicar notícias.
Novas notícias são criadas como rascunho.

A listagem administrativa usa `GET /api/admin/posts`, com acesso para `ADMIN` e
`EDITOR`. Integrações que usavam `GET /api/posts/admin` devem atualizar esse
endereço: `GET /api/posts/:slug` é a consulta pública de uma notícia, inclusive
quando seu slug é `admin`.

