# Preparação para produção

[Voltar ao início](../README.md)

O portal pode rodar como uma aplicação Node.js única: a API entrega o build de
`client/dist`, os endpoints `/api` e as imagens de `/api/uploads` no mesmo
endereço. O Vite continua sendo usado para desenvolver e compilar o cliente;
ele não precisa ficar aberto em produção.

Este guia prepara o projeto. A contratação da hospedagem, o domínio, o HTTPS e
a configuração dos volumes persistentes dependem do provedor escolhido.

Para começar nos planos gratuitos de Render e Supabase, siga o
[guia específico](hosting-free.md). Nesse caso as imagens ficam no Supabase
Storage, pois o Render gratuito não oferece disco persistente.

## Conferir o modo de produção no computador

Mantenha o `server/.env` local já configurado. Pare a API de desenvolvimento com
`Ctrl+C` para liberar a porta 3000 e execute, na raiz:

```sh
npm --prefix client run build
npm --prefix server run start:prod
```

Abra `http://localhost:3000`. O site, os arquivos compilados, a API e os uploads
agora vêm da mesma porta. `start:prod` define `NODE_ENV=production` no processo;
não altera o arquivo `.env`. Antes de atualizar para esta versão, gere o cliente
Prisma e aplique as migrações: `(cd server && npx --no-install prisma generate &&
npx --no-install prisma migrate deploy)`. A revisão de segurança adiciona
`User.sessionVersion`, sem remover contas ou notícias. Para voltar ao
desenvolvimento, pare esse processo e use os dois
comandos `run dev` habituais, conforme o [guia de instalação](installation.md).

Se aparecer `EADDRINUSE`, outra aplicação já ocupa a porta configurada. Pare a
API que estiver rodando em outro terminal com `Ctrl+C`, ou teste em uma porta
livre, sem alterar o `.env`:

```sh
PORT=3001 npm --prefix server run start:prod
```

Nesse caso, abra `http://localhost:3001`. A variável passada no comando tem
precedência sobre o valor do `.env`.

Se o build não existir, o servidor informa o comando necessário e não inicia
uma página incompleta. As notícias continuam usando endereços com hash, como
`/#/noticias/feira-de-ciencias`; o hash não é enviado ao servidor.

## Instalação em uma hospedagem nova

Use Node.js 24 LTS, PostgreSQL e uma pasta de uploads persistente.

1. Baixe a versão aprovada do repositório e instale as dependências:

   ```sh
   npm --prefix server ci
   npm --prefix client ci
   ```

2. No ambiente novo, use `server/.env.production.example` como modelo para
   `server/.env`, ou configure as mesmas variáveis no painel da hospedagem.
   Preencha a conexão do banco e um segredo JWT próprio. Os exemplos podem ser
   versionados; o arquivo `.env` preenchido não pode.

3. Gere o cliente Prisma e aplique as migrações, na pasta `server`:

   ```sh
   npx prisma generate
   npx prisma migrate deploy
   ```

   O Prisma CLI é usado nesta etapa de preparação. Se o banco estiver vazio,
   crie o primeiro administrador com `node scripts/create-admin.js` em um
   terminal interativo. Não repita esse passo se sua conta já estiver no banco.

4. Na raiz, compile o site e, se desejar uma instalação menor de runtime,
   retire as dependências de desenvolvimento do servidor:

   ```sh
   npm --prefix client run build
   npm --prefix server prune --omit=dev
   ```

   Preserve o cliente Prisma gerado em `server/node_modules/.prisma`, além dos
   pacotes de produção em `server/node_modules`. Não copie `node_modules` de
   outro sistema operacional; instale e gere os artefatos no ambiente de destino.

5. Inicie com `npm --prefix server run start:prod`. Em plataformas que já
   definem `NODE_ENV=production`, `npm --prefix server start` também funciona.
   Configure o serviço para reiniciar após uma falha ou reinicialização da
   máquina, usando os recursos do provedor ou o gerenciador de processos dele.

O código do servidor, o build do cliente e o cliente Prisma gerado precisam
estar disponíveis no runtime. Dependências usadas ao iniciar a API, incluindo
`dotenv` e `swagger-jsdoc`, estão declaradas como dependências de produção.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL da hospedagem; use a URL fornecida pelo provedor, com caracteres especiais corretamente codificados. |
| `JWT_SECRET` | Segredo exclusivo desse ambiente, com pelo menos 32 caracteres. |
| `JWT_EXPIRES_IN` | Duração da sessão; padrão `1h`. |
| `NODE_ENV` | `production` no servidor publicado. |
| `UPLOAD_STORAGE` | `local` (padrão) para disco persistente ou `supabase` para armazenamento externo. |
| `DATABASE_SSL_CA` | Certificado CA PEM do banco; quando informado, habilita TLS com verificação estrita na API e no Prisma CLI. |
| `SUPABASE_URL` | Origem HTTPS do projeto em `supabase.co`, quando usar armazenamento Supabase. |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...`, exclusiva do servidor. Não usar prefixo `VITE_`. |
| `SUPABASE_STORAGE_BUCKET` | Bucket público das capas; padrão `portal-capas`. |
| `PORT` | Porta HTTP da aplicação; padrão `3000`, ou a porta fornecida pela hospedagem. |
| `SERVE_CLIENT` | `true` entrega o site compilado junto à API; é o padrão quando `NODE_ENV=production`. Use `false` para hospedar o cliente separadamente. |
| `CLIENT_DIST_DIR` | Pasta do build, relativa a `server` ou absoluta; padrão `../client/dist`. |
| `UPLOAD_DIR` | Pasta de imagens, relativa a `server` ou absoluta; padrão `uploads`. Em produção ela precisa estar em volume persistente. |
| `TRUST_PROXY` | Quantidade de proxies confiáveis entre o visitante e a API; padrão `0`. Configure a quantidade real informada pelo provedor. |
| `CORS_ORIGINS` | Origens HTTP/HTTPS exatas, separadas por vírgula, se o cliente estiver em outro endereço. Deixe vazio para site e API na mesma origem. |

Não use `TRUST_PROXY=true`: a configuração aceita uma quantidade explícita de
proxies. Essa informação também permite aplicar os limites de tentativas por
visitante quando há um proxy na frente da API. O caminho até a aplicação deve
respeitar essa quantidade; consulte a configuração de rede da hospedagem.

Para um cliente separado, por exemplo, defina
`CORS_ORIGINS=https://portal.exemplo.com`. Caminhos, curingas e credenciais não
são aceitos nessa lista. CORS controla o acesso a respostas pelo navegador; as
permissões da API continuam sendo verificadas pela autenticação.

## Endereço público, arquivos e verificação

Configure HTTPS com o provedor ou proxy reverso. Encaminhe todas as rotas da
origem pública para a aplicação Node.js, incluindo `/api`, `/api/uploads`,
`/assets`, `/images` e `/favicon.svg`. Use URLs HTTPS para capas externas.

O HTML não recebe cache longo. Os arquivos com hash em `/assets` recebem cache
imutável de um ano. Um arquivo ausente ou endpoint desconhecido mantém a
resposta `404`, em vez de receber o HTML do portal. A documentação da API em
`/api-docs` usa o servidor atual, sem apontar para o localhost de quem visita.

Depois de publicar, confira:

- `GET /api/health`: a aplicação deve responder `200` com `status: ok`.
- `GET /api/health/database`: o banco deve responder `200`.
- A página inicial, o login, uma notícia e uma imagem enviada pelo painel.
- A permanência das imagens após reiniciar ou atualizar a aplicação.

O processo trata `SIGTERM` e `SIGINT`: para de aceitar conexões, aguarda as
requisições em andamento e desconecta o Prisma. Há um limite de dez segundos
para o encerramento; não é necessário interromper o processo à força em uma
atualização normal.

## Persistência e backups

O código no GitHub não guarda os dados do PostgreSQL nem os arquivos de
`UPLOAD_DIR`. Mantenha ambos em armazenamento persistente. Se usar múltiplas
instâncias da API, todas precisam acessar a mesma pasta de imagens ou um
armazenamento compartilhado compatível; discos separados por instância não
mantêm os uploads disponíveis para todos os visitantes.

Antes de uma migração ou atualização, faça um backup do banco e dos uploads.
Pause novas publicações/envios enquanto produz esse par de backups para evitar
referências a imagens que ainda não entraram na cópia. Use ferramentas cliente
PostgreSQL compatíveis com a versão do servidor.

Exemplo manual na raiz, com `DATABASE_URL` já definida no terminal e a pasta de
uploads padrão (adapte a pasta se você alterou `UPLOAD_DIR`):

```sh
mkdir -p backups
pg_dump --format=custom --file=backups/banco.dump "$DATABASE_URL"
tar -czf backups/uploads.tar.gz -C server uploads
```

Use nomes diferentes para cada data e armazene as cópias em outro local privado.
A pasta `backups/` está no `.gitignore`. Uma cópia no mesmo disco da aplicação
não protege contra a perda desse disco.

Teste periodicamente a restauração em um **banco novo de conferência**, com uma
conexão separada em `DATABASE_URL_RESTAURACAO`:

```sh
pg_restore --no-owner --dbname="$DATABASE_URL_RESTAURACAO" backups/banco.dump
mkdir -p backups/restauracao-uploads
tar -xzf backups/uploads.tar.gz -C backups/restauracao-uploads
```

Aponte uma instância de conferência para esse banco e para a pasta de uploads
restaurada e abra as notícias e imagens. Esses comandos não agendam backups nem
executam uma restauração automaticamente; configure a rotina e a retenção na
hospedagem escolhida e confirme o resultado com uma restauração de teste.

## Auditoria de dependências

Na pasta `server`, use `npm audit --omit=dev` para consultar as ocorrências na
instalação de produção e `npm audit` para incluir ferramentas de desenvolvimento.
Faça a mesma conferência na pasta `client` para as bibliotecas do cliente.

Na revisão de 10/11/2026, a instalação de produção do servidor ficou sem
ocorrências após aplicar um override restrito de `swagger-jsdoc` para
`glob ^14.0.4`, que usa a linha corrigida do `minimatch`. A documentação gerada
foi comparada com a anterior, sem perda de caminhos ou operações, e há um teste
de regressão para essa geração. Esse override deve ser revisto quando o
`swagger-jsdoc` atualizar suas próprias dependências.

A auditoria completa do servidor ainda indicou 20 ocorrências em ferramentas de
desenvolvimento, como Jest e nodemon, e suas dependências. As versões diretas
foram mantidas: a correção automática forçada propunha rebaixar o Jest para uma
versão antiga. Esses avisos não aparecem no relatório com `--omit=dev`, mas devem
continuar sendo acompanhados para aplicar correções compatíveis quando forem
disponibilizadas. O número de ocorrências pode mudar com novas publicações do npm.

Não aplique `npm audit fix --force` automaticamente. Atualize de forma restrita,
confira o lockfile e execute os testes e o build antes de integrar uma alteração.
