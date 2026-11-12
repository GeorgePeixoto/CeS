# Spec: `platform`

> Módulo P0. Depende de: — . Áreas comuns (stack, comandos, estilo, limites) em [SPEC.md](SPEC.md).

## Objetivo
Base técnica que os outros módulos usam: app Express testável, banco SQLite com migrações, validação, formato padrão de erro e layout base das páginas. Não entrega nenhuma funcionalidade de negócio.

## Escopo
- `package.json` com os scripts do SPEC.md e `"type": "module"`.
- `createApp({ dbPath, sessionSecret })` em `src/app.js`, que devolve o app Express sem chamar `listen`.
- `src/db/connection.js`: abre o `DatabaseSync`, liga `PRAGMA foreign_keys = ON` e `journal_mode = WAL` (só em arquivo) e exporta `transaction(db, fn)` (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`).
- `src/db/migrate.js`: aplica `migrations/*.sql` em ordem alfabética, registra cada uma em `schema_migrations(name, applied_at)` e é idempotente.
- `src/lib/errors.js`: `HttpError`, `ValidationError(fields)`, `NotFoundError`, `ConflictError(code)`, `UnauthorizedError`.
- `src/lib/http.js`: `asyncHandler` e o middleware de erro. Erro inesperado → `500 { error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' } }`, sem stack na resposta; o detalhe vai para o log.
- `src/lib/validation.js`: `requiredString(max)`, `optionalString(max)`, `positiveInt`, `isoDate`, `time` (`HH:MM`), `phoneBR` (normaliza para 10 ou 11 dígitos), `email`.
- `express.json({ limit: '50kb' })`, estáticos de `public/`, 404 JSON em `/api/*`.
- Cabeçalhos básicos: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`.
- `GET /api/health` → `{ data: { status: 'ok' } }`.
- Layout base: `public/css/styles.css` (responsivo, legível no celular) e `public/js/api.js` (wrapper de `fetch` que trata `{ data }` / `{ error }` e mostra a mensagem em pt-BR).
- `.env.example` e `.gitignore` (`node_modules/`, `.env`, `data/*.db*`).
- `tests/helpers.js`: `startTestApp()` → `{ baseUrl, db, close }`.

## Critérios de aceite
1. `npm run db:migrate` rodado duas vezes seguidas não dá erro nem aplica nada da segunda vez.
2. `GET /api/health` → 200 `{ data: { status: 'ok' } }`.
3. `GET /api/nao-existe` → 404 com `{ error: { code: 'NOT_FOUND' } }`.
4. Uma rota que lança `ValidationError({ name: 'Obrigatório' })` responde 400 com `fields.name`.
5. Uma rota que lança `Error` genérico responde 500 sem stack trace no corpo.
6. JSON malformado no corpo → 400 `VALIDATION_ERROR`, não 500.
7. `transaction()` desfaz tudo quando a função lança erro.
8. `phoneBR('(88) 99999-1234')` → `'88999991234'`. Telefone com menos de 10 dígitos → inválido.

## Verificação
- `npm test -- tests/platform`
- Manual: `npm run dev`, abrir `http://localhost:3000/api/health`.
