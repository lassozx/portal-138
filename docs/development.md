# Desenvolvimento

[Voltar ao início](../README.md)

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

## Integração contínua

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa no
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

O servidor pode entregar o build do cliente e a API na mesma origem. Consulte o
[guia de produção e backups](production.md) para usar `start:prod`, configurar
variáveis de ambiente, volumes, proxy, cópias de dados e restauração.

## Organização do código

- `client/src/main.jsx` inicia o React e importa o CSS global.
- `client/src/app/` contém a composição do portal e a navegação por hash.
- `client/src/pages/` reúne as telas de login, perfil, notícia e administração.
- `client/src/components/` contém partes reutilizáveis, separadas por contexto:
  `account`, `admin`, `layout`, `news` e `ui`. Estilos exclusivos acompanham seus
  componentes ou páginas; `client/src/styles/` reúne os estilos globais.
- `client/src/hooks/` contém hooks; `client/src/utils/` contém funções auxiliares.
- `client/public/images/` contém imagens fixas. O favicon fica em `client/public/`.
- `client/tests/` agrupa os testes por contexto e mantém o setup compartilhado.
- `server/src/` separa a API em configuração, middlewares e rotas.
- `server/tests/unit/` contém testes de rotas com banco simulado e de middlewares;
  `server/tests/integration/` contém os testes que precisam de PostgreSQL.
- `server/prisma/` contém o schema e as migrações; `server/scripts/` contém os
  utilitários de criação inicial de contas, categorias e notícias.
- `server/uploads/` é a pasta de dados enviada pelo painel, criada em execução,
  ignorada pelo Git e incluída no backup. Ela não deve ir para `client/public/`.

Ao criar um arquivo, escolha a pasta de sua responsabilidade e atualize os
imports de quem o utiliza. Testes novos devem ficar em `client/tests/` ou
`server/tests/`, junto aos testes da mesma área. Os scripts `npm test`, os
comandos de execução e a integração contínua continuam funcionando da raiz de
cada pacote, como nos exemplos acima.

## Arquivos gerados e ferramentas

O cliente Prisma utilizado pela API vem de `@prisma/client`, gerado com
`npx prisma generate` na pasta `server`. O antigo diretório
`server/src/generated/prisma/` era uma cópia gerada de um schema antigo, sem
imports na aplicação. Ele foi retirado do versionamento e está no `.gitignore`.
O schema e todas as migrações continuam em `server/prisma/`.

A referência de skills do Prisma fica em `server/.agents/skills/`. As cópias
idênticas para `.claude`, `.cursor` e `.devin` foram removidas do repositório e
ignoradas. O `postinstall` que recriava essas cópias a cada instalação foi
retirado; a geração do cliente Prisma continua explícita na instalação e no CI.
Se precisar atualizar as skills de uma ferramenta localmente, execute
`npx prisma skills sync` na pasta `server` e revise as mudanças da referência
em `.agents` antes de versionar.

## Apresentação no GitHub

Para atualizar as prévias da interface, o cartão de compartilhamento e os
campos About e Topics do GitHub, consulte o [guia de apresentação do repositório](github.md).
