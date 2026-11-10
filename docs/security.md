# Revisão de segurança

[Voltar ao início](../README.md)

Revisão de 10/11/2026, baseada na `main` em `3ed5ace`. Foram revisados os cinco
grupos abaixo e os uploads. Não existe uma lista única dos cinco ataques mais
frequentes; estes grupos cobrem os riscos mais relevantes para os recursos
atuais do portal. Os resultados descrevem os cenários testados, sem garantir
ausência de outras vulnerabilidades.

| Grupo | Proteções e verificações |
| --- | --- |
| SQL injection | Consultas pelo Prisma; as duas consultas SQL manuais usam tagged templates e SQL fixo, sem concatenação de entradas. Buscas e slugs com expressões SQL não alteraram as consultas; um comando SQL em comentário foi armazenado como texto. |
| XSS | React renderiza títulos, conteúdo, categorias, nomes e comentários como texto; não há `dangerouslySetInnerHTML`, `eval` ou inserção de HTML bruto. Testes de navegador confirmaram texto literal e ausência de execução de scripts. CSP restringe scripts à própria origem e bloqueia objetos e enquadramento; uploads usam `nosniff`. |
| CSRF | A API exige JWT no cabeçalho `Authorization: Bearer`, não aceita cookies como credencial e não recebe o token automaticamente em formulários externos. O token fica em `sessionStorage`, isolado por origem. CORS de produção só autoriza as origens configuradas. Testes com JSON, formulário, texto simples e navegador autenticado em origem externa não criaram comentários. CORS controla leitura pelo navegador; a autenticação continua sendo a barreira para executar ações. |
| Força bruta e uso indevido de sessões | Login e cadastro compartilham limite de 10 tentativas por IP a cada 15 minutos. Troca de senha tem limite de 10 tentativas por conta no mesmo período. Senhas usam bcrypt com custo 12 e limite de 72 bytes para senhas novas. JWT aceita apenas HS256; tokens adulterados, expirados ou com outro algoritmo são rejeitados. Trocar a senha revoga os tokens antigos. |
| Controle de acesso / IDOR | A API consulta o perfil atual no banco em cada requisição e valida as permissões de cada operação. Usuários comuns não acessam o painel; editores não gerenciam usuários, publicam ou excluem notícias. Usuário não exclui comentário alheio; rascunhos não aparecem nos endpoints públicos. Campos extras não promovem contas. Mudanças de perfil administrativo usam transação e bloqueio. |

## Correções desta revisão

- Adicionado limite às tentativas de senha no perfil. Antes havia limite no
  login, mas uma sessão autenticada permitia repetir tentativas da senha atual
  sem esse controle.
- Adicionada versão de sessão persistida em `User.sessionVersion`. Antes, trocar
  a senha não revogava tokens já emitidos, que continuavam válidos até expirar.
  A atualização de perfil confere a versão também ao gravar, para rejeitar uma
  requisição cuja sessão foi revogada enquanto estava em andamento.
- A interface guarda o novo token após a troca, mantendo a sessão atual.
  Tokens antigos sem versão correspondem à versão zero e deixam de valer após
  a primeira troca de senha.
- Respostas de autenticação e endpoints autenticados usam `Cache-Control:
  no-store`, evitando cache de tokens e dados de conta.
- Reforçados CSP (`base-uri`, `form-action`, `frame-ancestors`) e
  `X-Frame-Options: DENY` contra alteração da base de links e clickjacking.
- JSON malformado recebe mensagem genérica sem registrar trechos do corpo,
  que poderiam conter uma senha.

## Uploads

Somente administradores e editores podem enviar imagens. A API aceita JPEG,
PNG e WebP de até 5 MB, verifica a assinatura, gera nomes aleatórios e limita
a 30 tentativas por conta por hora. SVG e conteúdo HTML disfarçado são
rejeitados. A entrega usa extensão e tipo de imagem, `nosniff` e CSP restrita;
nomes arbitrários e arquivos internos não são entregues.

A verificação de assinatura não é uma análise antivírus ou uma decodificação
completa da imagem. As imagens são públicas, inclusive quando vinculadas a
rascunhos. As URLs de capa externas são carregadas pelo navegador, não pelo
servidor; a API não baixa URLs fornecidas pelos usuários.

## Validação e reprodução

Os testes automatizados da API incluem banco isolado, SQL injection, elevação
de privilégios, acesso a rascunhos, IDOR, tokens adulterados, CSRF, revogação de
sessões, limites e uploads. Os testes do cliente incluem renderização de HTML
malicioso como texto e substituição do token ao trocar a senha.

Resultado desta revisão: **196 testes da API e 89 do cliente passaram**;
o build de produção também foi gerado com sucesso. O CI agora executa
`npm audit --omit=dev` no cliente e no servidor, além dos testes e do build.

Também foram executados testes de Chromium contra o build de produção: XSS
armazenado na página inicial, notícia, autor, categoria e comentários; troca de
senha e restauração da sessão; e requisições de outra origem com o navegador
autenticado. A validação local usou PGlite com protocolo PostgreSQL; o CI usa
PostgreSQL 18 e aplica as migrações antes dos testes.

Para executar os testes no ambiente de desenvolvimento, com o banco de teste
configurado em `server/.env`:

```sh
(cd server && npx --no-install prisma generate && npx --no-install prisma migrate deploy) &&
npm --prefix server test &&
npm --prefix client test &&
npm --prefix client run build &&
npm --prefix server audit --omit=dev &&
npm --prefix client audit --omit=dev
```

Não aponte os testes para o banco de produção. Os testes de integração criam
contas e notícias temporárias e as removem ao concluir.

Na data da revisão, as auditorias de dependências de produção do cliente e do
servidor não retornaram vulnerabilidades conhecidas. A instalação completa
continua com alertas nas ferramentas de desenvolvimento, conforme o
[guia de produção](production.md). Os alertas mudam com novas publicações;
repita a auditoria antes de atualizar ou publicar.

## Configuração necessária na hospedagem

- HTTPS e segredo JWT aleatório exclusivo do ambiente; não reutilize os
  segredos de teste ou as credenciais locais. Não versione `.env`.
- `NODE_ENV=production`, origens CORS exatas e `TRUST_PROXY` correspondente ao
  caminho real até a API, impedindo contornar o limite por IP via cabeçalhos.
- Os limites atuais ficam na memória de cada processo e são reiniciados com o
  servidor. Ao usar várias réplicas, adote armazenamento compartilhado para os
  limites. Eles não substituem a proteção contra DDoS do provedor.
- Banco sem acesso público desnecessário, volume persistente para uploads e
  backups com restauração verificada, conforme o guia de produção.
- Atualizações periódicas. Se passar a aceitar HTML rico, cookies de sessão
  ou downloads de URLs no servidor, revise respectivamente sanitização,
  proteção CSRF e SSRF antes de habilitar essas mudanças.

O logout atual remove o token deste navegador; ele não revoga individualmente
uma cópia roubada do token. Em suspeita de exposição, trocar a senha revoga as
sessões anteriores da conta. Tokens no navegador ainda dependem da prevenção
de XSS; `sessionStorage` não impede acesso por um script que já execute na
mesma origem.
