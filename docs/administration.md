# Painel administrativo

[Voltar ao início](../README.md)

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

### Endpoints do painel

| Método e endereço | Acesso | Uso |
| --- | --- | --- |
| `POST /api/uploads` | ADMIN, EDITOR | Corpo binário da imagem, com `Content-Type: image/jpeg`, `image/png` ou `image/webp`; retorna `url`. Não usa multipart. |
| `GET /api/uploads/:filename` | Público | Entrega uma imagem enviada. |
| `GET /api/admin/users` | ADMIN | Lista paginada; filtros `page`, `limit`, `search` e `role`. |
| `POST /api/admin/users` | ADMIN | Cria uma conta com `name`, `email`, `password` e `role`. |
| `PATCH /api/admin/users/:id/role` | ADMIN | Altera o perfil com `{ "role": "USER" }`, `EDITOR` ou `ADMIN`. |

