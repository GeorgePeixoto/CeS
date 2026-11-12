# Spec: `admin-auth`

> Módulo P0. Depende de: `platform`. Áreas comuns em [SPEC.md](SPEC.md).

## Objetivo
Garantir que só a equipe do Núcleo acesse a área administrativa. O público nunca precisa de conta.

## Modelo de dados (migração `002_admin_users.sql`)
```sql
CREATE TABLE admin_users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## Interface
| Rota | Descrição |
|---|---|
| `POST /api/admin/login` `{ email, password }` | 200 `{ data: { id, name, email } }` e cria a sessão; 401 `INVALID_CREDENTIALS` |
| `POST /api/admin/logout` | encerra a sessão; 204 |
| `GET /api/admin/me` | 200 com o usuário logado; 401 sem sessão |
| middleware `requireAdmin` | exportado em `src/modules/admin-auth/middleware.js`; 401 `UNAUTHORIZED` |

- Sessão com `express-session`: cookie `httpOnly`, `sameSite: 'lax'`, `secure` só em produção, expira em 8h. `SESSION_SECRET` é obrigatório; sem ele, o app não sobe.
- O id da sessão é regenerado no login (`req.session.regenerate`).
- Limite de tentativas em memória: 5 falhas por e-mail+IP em 15 minutos → 429 `TOO_MANY_ATTEMPTS`.
- A mensagem de erro é a mesma para e-mail inexistente e senha errada ("E-mail ou senha inválidos.").
- Páginas: `public/admin/login.html`. Toda página `admin/*.html` chama `/api/admin/me` ao carregar e redireciona para o login se receber 401.
- `scripts/create-admin.js --email --name`: lê a senha do terminal (mínimo de 8 caracteres) e grava o hash com bcrypt (custo 12). Não existe cadastro de admin pela web na v1.

## Critérios de aceite
1. Login com as credenciais certas → 200, cookie de sessão definido, e `/api/admin/me` devolve o usuário.
2. Senha errada ou e-mail inexistente → 401 com a mesma mensagem.
3. `GET /api/admin/qualquer-rota-protegida` sem sessão → 401.
4. Depois do logout, `/api/admin/me` → 401.
5. A 6ª tentativa errada em 15 minutos → 429.
6. `password_hash` começa com `$2` e nunca é igual à senha. A senha não aparece em nenhuma resposta nem log.
7. Respostas da API nunca incluem `password_hash`.

## Verificação
- `npm test -- tests/admin-auth`
- Manual: criar o admin pelo script, entrar em `/admin/login.html`, acessar `/admin/atividades.html` e sair.
