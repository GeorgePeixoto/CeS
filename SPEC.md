# Spec: Sistema de Gestão de Oficinas — Núcleo de Arte, Educação e Cultura Marcus Jussier

> Protótipo acadêmico. Juazeiro do Norte – CE. Status: **rascunho para aprovação** (2026-11-11).
> Prazo de entrega: **2026-11-13** (2 dias).

## Objetivo

Hoje as informações sobre oficinas, cursos e eventos do Núcleo ficam espalhadas. O sistema junta atividades, instrutores, horários, vagas, inscrições e presença em um só lugar.

**Usuários**
- **Público em geral** (área pública, sem login): consulta a programação, faz a pré-inscrição e consulta a própria inscrição.
- **Equipe do Núcleo** (área administrativa, com login): cadastra atividades e instrutores, gerencia inscrições e participantes, registra a presença e vê os indicadores.

**Sucesso:** o público consulta a programação e se pré-inscreve sozinho. A equipe cadastra atividades, controla vagas, registra presença e vê relatórios básicos sem precisar de planilhas.

**Fora de escopo (v1):** pagamentos, certificados, notificações (e-mail/WhatsApp), app mobile, integração com sistemas da prefeitura, relatórios avançados, deploy em hospedagem, níveis de permissão na equipe e cancelamento da inscrição pelo próprio público. O escopo pode mudar depois da validação com o Núcleo.

## Mapa de módulos (aprovado)

| Módulo | Responsabilidade | Depende de | Spec | Prioridade |
|---|---|---|---|---|
| `platform` | App Express, SQLite e migrações, validação, erros, layout base | — | [SPEC-platform.md](SPEC-platform.md) | P0 |
| `admin-auth` | Login da equipe, sessão, hash de senha, proteção do `/admin`, criação do 1º admin | platform | [SPEC-admin-auth.md](SPEC-admin-auth.md) | P0 |
| `activities` | Categorias, instrutores e atividades (admin) + catálogo público | platform, admin-auth | [SPEC-activities.md](SPEC-activities.md) | P0 |
| `enrollments` | Pré-inscrição com bloqueio de vagas, consulta por protocolo, gestão no admin | activities | [SPEC-enrollments.md](SPEC-enrollments.md) | P0 |
| `attendance` | Chamada por data de encontro | enrollments | [SPEC-attendance.md](SPEC-attendance.md) | P1 |
| `reports` | Indicadores e gráficos (Chart.js) | enrollments, attendance | [SPEC-reports.md](SPEC-reports.md) | P2 |

**Ordem de construção:** platform → admin-auth → activities → enrollments → attendance → reports

**Linha de corte (prazo de 2 dias):** P0 é obrigatório. P1 entra se o P0 estiver verde até o fim do dia 1. P2 pode virar uma tabela simples sem gráfico se o tempo apertar. Os ids dos módulos não mudam.

## Tech Stack

| Camada | Escolha | Observação |
|---|---|---|
| Runtime | Node.js 26.x (instalado: v26.13.0) | ESM (`"type": "module"`) |
| Servidor | Express 5 | dependência a aprovar |
| Banco | SQLite via `node:sqlite` (`DatabaseSync`), embutido no Node | sem dependência; arquivo em `data/nucleo.db` |
| Sessão | `express-session` (MemoryStore) | dependência a aprovar; aceitável só para protótipo local |
| Hash de senha | `bcryptjs` (custo 12) | dependência a aprovar; JS puro, sem build nativo no Windows |
| Front-end | HTML + CSS + JavaScript puro, com `fetch` na API JSON | sem framework, sem bundler |
| Gráficos | Chart.js 4.4.1 por CDN (cdnjs) | só no módulo `reports` |
| Testes | `node:test` + `node:assert/strict` + `fetch` nativo | sem dependência |
| Config | `node --env-file-if-exists=.env` | dispensa o `dotenv` |

As dependências de runtime ficam limitadas a: `express`, `express-session` e `bcryptjs`. Qualquer outra precisa de aprovação.

## Commands

```bash
npm install                      # instala as dependências
npm run db:migrate               # aplica as migrações em data/nucleo.db
npm run db:seed                  # dados de exemplo (categorias, instrutores, atividades)
npm run admin:create -- --email equipe@nucleo.local --name "Equipe"   # pede a senha no terminal
npm run dev                      # node --watch --env-file-if-exists=.env src/server.js  → http://localhost:3000
npm start                        # node --env-file-if-exists=.env src/server.js
npm test                         # node --test "tests/**/*.test.js"
npm run test:coverage            # node --test --experimental-test-coverage "tests/**/*.test.js"
npm run check                    # node --check em todos os .js (não há linter na v1, para não adicionar dependências)
```

**Variáveis de ambiente** (`.env`, nunca commitado; o modelo fica em `.env.example`):

```
PORT=3000
SESSION_SECRET=troque-por-um-valor-aleatorio-longo
DB_PATH=data/nucleo.db
NODE_ENV=development
TZ=America/Fortaleza
```

## Project Structure

```
src/
  server.js                 → só faz o listen; lê env e chama createApp
  app.js                    → createApp({ dbPath, sessionSecret }) — usado também pelos testes
  db/
    connection.js           → abre o DatabaseSync, PRAGMA foreign_keys=ON, helper transaction()
    migrate.js              → aplica db/migrations/*.sql em ordem; tabela schema_migrations
    migrations/NNN_*.sql    → uma migração por módulo/alteração
  lib/
    validation.js           → validadores puros (string, inteiro, data, telefone, horário)
    errors.js               → classes HttpError (ValidationError 400, NotFound 404, Conflict 409, ...)
    http.js                 → asyncHandler, middleware de erro → JSON { error: { code, message, fields } }
  modules/<module-id>/
    repository.js           → SQL (prepared statements). Único lugar com SQL do módulo
    service.js              → regras de negócio (vagas, protocolo, frequência)
    routes.js               → rotas públicas (/api/...) e admin (/api/admin/...)
public/
  index.html                → catálogo
  atividade.html            → detalhe + formulário de pré-inscrição
  consulta.html             → consulta por protocolo
  admin/*.html              → login, atividades, instrutores, inscrições, presença, relatórios
  css/styles.css
  js/                       → um arquivo por página + api.js (wrapper de fetch)
scripts/
  seed.js, create-admin.js
tests/
  helpers.js                → sobe o app com DB em memória numa porta aleatória
  <module-id>/*.test.js
data/                       → arquivo SQLite (fora do controle de versão)
SPEC.md, SPEC-<module-id>.md, CLAUDE.md, BACKLOG.md
```

## Code Style

- **Idioma:** código, nomes de arquivos, tabelas, colunas e rotas em **inglês**. Textos da interface e mensagens de erro para o usuário em **português do Brasil**.
- ESM, `const` por padrão, funções pequenas, sem classes exceto para os erros.
- `camelCase` no JS e `snake_case` no SQL. O repositório converte entre os dois.
- Formatação: 2 espaços, aspas simples, ponto e vírgula, até 100 colunas.
- SQL só com prepared statements (`?` ou parâmetros nomeados). Nunca concatenar entrada do usuário.
- Toda entrada é validada no back-end, mesmo que o front também valide.
- Datas em ISO (`YYYY-MM-DD`), horários em `HH:MM`, timestamps em ISO UTC. Fuso de exibição: America/Fortaleza.

```js
// src/modules/activities/routes.js
import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requireAdmin } from '../admin-auth/middleware.js';
import { parseActivityInput } from './validation.js';

export function activityRoutes({ service }) {
  const router = Router();

  router.get('/api/activities', asyncHandler(async (req, res) => {
    const activities = service.listPublished({
      search: req.query.q,
      categoryId: req.query.category,
    });
    res.json({ data: activities });
  }));

  router.post('/api/admin/activities', requireAdmin, asyncHandler(async (req, res) => {
    const input = parseActivityInput(req.body); // lança ValidationError com { fields }
    const activity = service.create(input);
    res.status(201).json({ data: activity });
  }));

  return router;
}
```

**Contrato da API:** sucesso → `{ data }`; erro → `{ error: { code, message, fields? } }`. `code` é uma constante em inglês (`VALIDATION_ERROR`, `NO_SEATS`); `message` é em pt-BR para exibição.

## Testing Strategy

- **Framework:** `node:test`. Cada arquivo de teste sobe o app com `createApp({ dbPath: ':memory:' })` numa porta aleatória e faz requisições com `fetch`.
- **Níveis:**
  - *Unitário:* validadores (`lib/validation.js`) e regras puras dos services (protocolo, cálculo de vagas e frequência).
  - *Integração (HTTP + SQLite em memória):* o nível principal. Cada critério de aceite dos specs de módulo vira pelo menos um teste.
  - *Manual:* roteiro curto no navegador por módulo (listado em cada spec), já que não há E2E automatizado na v1.
- **Local:** `tests/<module-id>/`.
- **Cobertura:** meta ≥ 80% de linhas em `src/modules/**/service.js` e `src/lib/**`. Rotas e páginas são cobertas pelos testes de integração e pelo roteiro manual.
- **TDD:** em toda regra de negócio (vagas, duplicidade, frequência) o teste vem antes da implementação.
- `npm test` precisa passar antes de considerar uma fatia concluída.

## Boundaries

- **Sempre:**
  - Interface em pt-BR e código em inglês.
  - Validar entradas no back-end e usar prepared statements.
  - Hash de senha com bcrypt. Segredos só em variáveis de ambiente.
  - Coletar só o mínimo de dados pessoais (ver SPEC-enrollments).
  - Manter `CLAUDE.md` e `BACKLOG.md` atualizados.
  - Entregar em fatias pequenas e testáveis, com `npm test` verde ao fim de cada uma.
  - Atualizar o spec antes de mudar uma decisão.
- **Perguntar antes:**
  - Adicionar qualquer dependência, inclusive as três previstas, aprovadas no início do `platform`.
  - Mudar o schema do banco além do que está descrito nos specs.
  - Rodar `git init` ou mexer em configurações do repositório.
  - Mudar o escopo ou os critérios de aceite.
  - Apagar o arquivo do banco.
- **Nunca:**
  - Commitar `.env`, segredos ou `data/*.db`.
  - Guardar senha em texto puro.
  - Apagar dados sem confirmação explícita (na interface e no agente).
  - Expor dados pessoais de participantes em rotas públicas.
  - Implementar algo fora do escopo sem aprovação.
  - Desabilitar ou remover testes para ficar verde.

## Success Criteria (sistema)

1. Uma pessoa sem conta encontra uma atividade por busca ou categoria, vê data, horário, instrutor e vagas, se pré-inscreve e recebe um protocolo.
2. Com o protocolo + telefone, consulta a inscrição.
3. Quando as vagas acabam, a atividade aparece como esgotada e a API recusa novas inscrições (`409 NO_SEATS`), inclusive em requisições simultâneas.
4. A equipe faz login, cadastra instrutor e atividade (horários e vagas), confirma ou cancela inscrições e registra a presença por data.
5. A equipe vê inscritos por atividade, ocupação de vagas e frequência.
6. O `/admin` e o `/api/admin/*` recusam acesso sem sessão (`401` na API, redirecionamento para o login nas páginas).
7. `npm test` passa e `npm run db:migrate && npm run db:seed && npm start` deixa o sistema pronto para a demonstração.

## Open Questions

1. **Validação com o Núcleo:** o escopo pode mudar depois da apresentação. Mudanças entram no `BACKLOG.md` e só então no spec.
2. **Repositório git:** `c:\CeS` ainda não é um repositório. Fazer `git init` antes de começar? (Requer sua aprovação.)
3. **Idade mínima por atividade:** vale a pena ter (por exemplo, "a partir de 12 anos")? Proposta: campo opcional `min_age`, validado na inscrição.
