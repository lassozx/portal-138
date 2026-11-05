# Portal 138

Portal de notícias da comunidade escolar, com busca, categorias, comentários,
contas de usuário e painel administrativo. O cliente usa React, Vite e Tailwind;
a API usa Express, Prisma e PostgreSQL.

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

## Testes e build

Execute na raiz, após configurar `server/.env`, gerar o cliente Prisma e aplicar
as migrações:

```sh
npm --prefix server test
npm --prefix client test
npm --prefix client run build
```

Os testes de saúde e de integração de usuários usam o PostgreSQL real; mantenha o banco local
disponível. Os testes iniciam a própria API, sem exigir `npm run dev` em paralelo.
O build do cliente é gerado em `client/dist`.

## Imagens de capa

No formulário de notícias do painel, use **Enviar imagem de capa** para escolher
um arquivo JPG, PNG ou WebP de até **5 MB**. Administradores e editores podem
enviar imagens. A prévia aparece após o envio; salve a notícia para vincular a
capa. Também é possível continuar usando uma URL externa ou remover a capa.

A API verifica o tipo informado e a assinatura do arquivo, gera um nome próprio
e salva as imagens em `server/uploads/`. Essa pasta não é versionada. O envio é
limitado a 30 tentativas por usuário por hora. SVG não é aceito.

Para alterar a pasta, configure `UPLOAD_DIR` em `server/.env`. Caminhos relativos
partem da pasta `server`; caminhos absolutos também são aceitos. A API deve ter
permissão de escrita nessa pasta. As imagens são servidas em `/api/uploads/...`,
que já passa pelo proxy do Vite durante o desenvolvimento.

Em produção, use uma pasta em **volume persistente**, inclua-a no backup junto
com o PostgreSQL e encaminhe `/api/uploads` para a API. Um disco temporário da
hospedagem pode perder as imagens após uma atualização. Ao restaurar o projeto,
restaure o banco e a pasta de imagens juntos. Remover ou substituir uma capa não
apaga o arquivo antigo do disco: outra notícia pode utilizar o mesmo endereço.
Uploads de rascunhos não têm controle de leitura por usuário; quem possuir a URL
poderá abrir a imagem, então não envie arquivos confidenciais.

## Administração de usuários

Entre com um administrador e abra **Usuários** no painel. Essa aba permite:

- Buscar contas pelo nome ou e-mail, filtrar por perfil e navegar pelas páginas.
- Criar contas de usuário, editor ou administrador, com senha inicial de pelo
  menos 12 caracteres e no máximo 72 bytes em UTF-8.
- Alterar o perfil de outras contas, confirmando a mudança. Para retirar o
  acesso administrativo de alguém, altere seu perfil para **Usuário**.

Editores continuam com as permissões de edição de conteúdo existentes, sem
acesso à gestão de usuários. Não é permitido alterar o próprio perfil. A API
consulta o perfil atual em cada requisição, portanto alterações de acesso são
aplicadas na próxima requisição, sem esperar o token expirar. Mudanças de perfil
usam uma transação com bloqueio e nova conferência do administrador para impedir
que dois administradores removam simultaneamente o acesso um do outro.

As contas criadas pelo painel não recebem e-mail automático. Entregue a senha
inicial à pessoa por um canal privado e peça que ela a altere em **Meu perfil**.
O primeiro administrador continua sendo criado pelo script `create-admin.js`.
Não há migração de banco nem dependência nova para estas duas funcionalidades.

### Novos endpoints

| Método e endereço | Acesso | Uso |
| --- | --- | --- |
| `POST /api/uploads` | ADMIN, EDITOR | Corpo binário da imagem, com `Content-Type: image/jpeg`, `image/png` ou `image/webp`; retorna `url`. Não usa multipart. |
| `GET /api/uploads/:filename` | Público | Entrega uma imagem enviada. |
| `GET /api/admin/users` | ADMIN | Lista paginada; filtros `page`, `limit`, `search` e `role`. |
| `POST /api/admin/users` | ADMIN | Cria uma conta com `name`, `email`, `password` e `role`. |
| `PATCH /api/admin/users/:id/role` | ADMIN | Altera o perfil com `{ "role": "USER" }`, `EDITOR` ou `ADMIN`. |

## Integração contínua

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa no
GitHub Actions a cada pull request para a `main`, a cada push nessa branch ou
manualmente pela aba Actions, com dois jobs:

- **Cliente:** instala as dependências com `npm ci`, executa os testes e gera o
  build.
- **Servidor:** usa Node.js 24 e um PostgreSQL 18 temporário, instala as
  dependências com `npm ci`, gera o cliente Prisma, aplica as migrações com
  `prisma migrate deploy` e executa os testes.

As variáveis e credenciais descartáveis do ambiente de CI estão definidas no
workflow. Não é necessário configurar secrets nem criar um arquivo `.env` no
GitHub. Consulte os resultados e os logs de falhas na aba **Actions** do
repositório ou nas verificações do pull request.

Para exigir a aprovação desses jobs antes de um merge, configure as regras de
proteção da branch no GitHub. A execução do workflow, por si só, não torna as
verificações obrigatórias nem publica o site.

## Configuração fora do ambiente local

As credenciais do Compose são apenas para desenvolvimento. Use credenciais
próprias e um segredo JWT exclusivo em cada ambiente; não versione o arquivo
`.env`. Para hospedar o build, configure o servidor para entregar os arquivos de
`client/dist` e encaminhar `/api` à API: o proxy do Vite funciona somente durante
o desenvolvimento.
