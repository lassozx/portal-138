# Hospedagem gratuita: Render e Supabase

[Voltar ao início](../README.md)

Configuração preparada em 10/11/2026 para começar com **banco vazio**. O Render
executa o site compilado e a API no mesmo endereço HTTPS. O Supabase fornece
PostgreSQL e armazenamento público das capas; o login continua sendo o do
Portal 138, com seus perfis, JWT e validações. Não é necessário Supabase Auth.

## Limites dos planos gratuitos

- O [Render Free](https://render.com/docs/free) suspende a aplicação após
  15 minutos sem acesso; a primeira visita seguinte pode levar cerca de um
  minuto para abrir. Há limites mensais e o plano é voltado a demonstrações e
  projetos pessoais, sem garantia de disponibilidade de produção.
- O disco do Render Free é temporário e perde alterações em reinicializações.
  Por isso o projeto usa **Supabase Storage** para as imagens. O PostgreSQL
  gratuito do Render expira após 30 dias; não é usado nesta configuração.
- O [Supabase Free](https://supabase.com/pricing) inclui 500 MB para banco e
  1 GB para arquivos, sujeito aos limites de tráfego. Projetos com pouca
  atividade podem ser pausados após uma semana e precisam ser retomados pelo
  painel. Não trate os planos gratuitos como armazenamento ilimitado.
- Selecione os planos Free e revise o resumo antes de criar recursos. Não
  habilite complementos pagos. Os provedores podem alterar suas condições.

## 1. Preparar o projeto Supabase

1. Entre em [Supabase](https://supabase.com/dashboard), crie uma organização
   Free e um projeto `portal-138`. Escolha uma região próxima de seus leitores
   e do serviço Render. Guarde a senha do banco no seu gerenciador de senhas.
2. **Antes de criar tabelas**, desative **Enable Data API** no painel de
   Data API/integrações. O portal usa Prisma pela conexão PostgreSQL; não usa
   os endpoints automáticos de tabelas. Isso impede que as tabelas de contas
   e hashes de senha fiquem acessíveis por uma segunda API sem as permissões
   do portal. A API de Storage é separada. Consulte
   [Prisma no Supabase](https://supabase.com/docs/guides/database/prisma) e
   [proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api).
3. Em **Connect**, copie a conexão **Session pooler**, porta **5432**. Ela
   funciona com IPv4 e com as transações do portal. A conexão será usada pelo
   Prisma e pela API. Prefira criar o usuário `prisma` com o SQL do guia oficial
   e usar `prisma.REFERENCIA` na conexão. Não use o Transaction pooler (6543)
   para as migrações. Codifique caracteres especiais da senha na URL.
4. Baixe o certificado CA do banco pelo painel Supabase, em **Database Settings
   > SSL Configuration**. Seu conteúdo PEM vai em `DATABASE_SSL_CA`. O portal
   força TLS com verificação do certificado e hostname ao configurar essa CA.
   O Prisma CLI recebe os parâmetros próprios de migração com validação
   estrita. Não desative a validação TLS para resolver erros de certificado.
5. Em **Storage**, crie o bucket **`portal-capas`** e marque-o como público,
   pois as capas das notícias são públicas. Limite o tamanho a **5 MB** e os
   tipos a `image/jpeg`, `image/png`, `image/webp`. Não crie políticas de upload
   para usuários anônimos: a API do portal fará os envios com chave de servidor.
6. Em **Settings > API Keys**, crie uma chave **secret** para o backend
   (`sb_secret_...`). Não use a publishable key. Guarde também a URL do projeto,
   no formato `https://REFERENCIA.supabase.co`.

Não cole senha do banco, URL com senha, chave secreta ou JWT_SECRET no chat,
em prints, no GitHub ou no cliente React. Use os campos privados dos provedores.
Nenhuma variável secreta deve receber prefixo `VITE_`.

## 2. Criar as tabelas e o primeiro administrador

Execute a preparação na sua máquina. Seu `server/.env` local permanece
apontando para o banco local; use outro arquivo para a conexão da hospedagem.

Na raiz do projeto, após integrar a branch aprovada:

```sh
npm --prefix server ci &&
(cd server && npx --no-install prisma generate)
```

Copie `server/.env.hosting.example` para `server/.env.hosting` e preencha a
`DATABASE_URL` do Supabase e `DATABASE_SSL_CA` no editor. Coloque o PEM entre
aspas, com quebras de linha reais ou `\n` literais. Esse arquivo é ignorado pelo Git.
Confira que a conexão aponta para seu **novo projeto vazio**. Aplique as
migrações e crie o administrador em um terminal interativo:

```sh
cd server
env -u DATABASE_URL -u DATABASE_SSL_CA node --env-file=.env.hosting node_modules/prisma/build/index.js migrate deploy &&
env -u DATABASE_URL -u DATABASE_SSL_CA node --env-file=.env.hosting scripts/create-admin.js
```

O script pergunta nome, e-mail e senha, oculta a senha digitada e cria apenas
uma conta nova. Não muda contas já cadastradas nem publica uma rota de criação
do primeiro administrador. O banco da hospedagem começa sem notícias ou
categorias. Cadastre-as pelo painel depois do login. Não execute seeds de
demonstração nem copie seu banco local.

No Linux, `env -u` evita que uma variável já exportada no terminal
se sobreponha ao arquivo específico da hospedagem. O `dotenv` dos scripts não
sobrescreve a variável carregada por `--env-file`.

## 3. Publicar no Render

O repositório inclui `render.yaml` e `scripts/render-build.sh`. O Blueprint
cria **um Web Service Free**, sem banco Render e sem disco pago.

1. Entre em [Render](https://dashboard.render.com), conecte seu GitHub ao
   repositório `lassozx/portal-138` e escolha **New > Blueprint**.
2. Escolha a branch **main**, após integrar o commit de hospedagem assinado.
   Confira o arquivo `render.yaml` e o plano **Free** antes de criar.
3. Preencha somente nos campos privados do Render:

   | Variável | Valor |
   | --- | --- |
   | `DATABASE_URL` | A conexão Session pooler usada para preparar o banco. |
   | `DATABASE_SSL_CA` | O conteúdo do certificado CA PEM baixado no Supabase. |
   | `SUPABASE_URL` | A origem HTTPS do projeto. |
   | `SUPABASE_SECRET_KEY` | A chave secret do backend. |

   O Blueprint gera um `JWT_SECRET` aleatório. Define `NODE_ENV=production`,
   `UPLOAD_STORAGE=supabase`, bucket `portal-capas` e Node.js 24. A porta é
   fornecida pelo Render; não fixe `PORT=3001`. Site e API usam a mesma origem,
   portanto não é necessário liberar outros domínios no CORS.
4. O build instala ferramentas para compilar, gera o Prisma e o cliente,
   audita dependências de produção e remove ferramentas de desenvolvimento do
   servidor. Ele **não altera o banco**. As migrações foram feitas no passo 2.
5. O Render inicia `npm --prefix server run start:prod` e oferece uma URL
   `https://NOME.onrender.com`, com HTTPS gerenciado. Abra-a e entre com o
   administrador criado no passo 2.

O arquivo define `TRUST_PROXY=1` para a conexão direta pelo proxy Render.
Confirme o IP do cliente e os limites ao publicar. Se adicionar outro proxy
ou CDN, revise essa configuração em vez de confiar em todos os proxies.

Pelo [Blueprint](https://render.com/docs/blueprint-spec), atualizações futuras
são publicadas depois que os checks do GitHub passarem. O plano gratuito não
tem pre-deploy nem terminal remoto. Sempre aplique novas migrações compatíveis
pelo arquivo privado da hospedagem antes de publicar a versão que depende delas.
Não coloque `migrate reset`, seeds, credenciais ou criação de admin no build.

## 4. Conferir a publicação

- `/api/health` responde com `status: ok` e `/api/health/database` confirma o banco.
- Login, criação de categoria, rascunho, publicação e comentário funcionam.
- Enviar uma capa gera uma URL pública HTTPS de `supabase.co`. A chave não
  aparece na resposta nem nas requisições do navegador.
- Depois de reiniciar o serviço no Render, a notícia e a capa continuam
  acessíveis. A capa está no Supabase, não no disco temporário.
- Uma sessão anterior deixa de funcionar após trocar a senha em outro navegador.
- A Data API do Supabase continua desativada, e uploads anônimos no Storage
  não são permitidos. O bucket público permite ler capas, sem permitir enviá-las.
- Registre os endereços dos painéis e uma rotina de backup para o banco e o
  bucket. O backup do banco não inclui os bytes das imagens do Storage.

Os testes locais cobrem o modo local, validações e o protocolo HTTP do Storage
com um provedor simulado. A configuração de conta, TLS, bucket e upload real
precisa ser verificada no projeto Supabase e no serviço Render após conectá-los.

Nesta preparação passaram 221 testes da API. O build completo foi executado
com `NODE_ENV=production`, geração do Prisma, auditorias sem alertas e remoção
das dependências de desenvolvimento. O runtime resultante entregou a página e
consultou o banco. A conexão TLS com CA também foi verificada em um proxy local
com `pg` e com o Prisma CLI, incluindo rejeição de certificado não confiável.
