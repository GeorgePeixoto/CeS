# Spec: `activities`

> Módulo P0. Depende de: `platform`, `admin-auth`. Áreas comuns em [SPEC.md](SPEC.md).

## Objetivo
A equipe cadastra categorias, instrutores e atividades (oficinas, cursos e eventos) com datas, horários e vagas. O público consulta a programação, pesquisa e filtra por categoria.

## Modelo de dados (migração `003_activities.sql`)
```sql
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE           -- ex.: Música, Teatro, Dança, Artes Visuais
);
CREATE TABLE instructors (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  bio        TEXT,                                    -- exibida no público
  phone      TEXT,                                    -- só admin
  email      TEXT,                                    -- só admin
  active     INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE activities (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('workshop','course','event')),  -- oficina, curso, evento
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  instructor_id INTEGER REFERENCES instructors(id),
  location      TEXT,
  start_date    TEXT NOT NULL,                        -- YYYY-MM-DD
  end_date      TEXT NOT NULL,                        -- >= start_date
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  min_age       INTEGER,                              -- opcional; validado na pré-inscrição
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE activity_schedules (
  id          INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = domingo
  start_time  TEXT NOT NULL,                                     -- HH:MM
  end_time    TEXT NOT NULL                                      -- > start_time
);
```
Um evento de um dia só usa `start_date = end_date` e um único horário.

## Interface

**Pública** (só atividades `published`, sem dados de contato do instrutor):
| Rota | Descrição |
|---|---|
| `GET /api/categories` | lista as categorias |
| `GET /api/activities?q=&category=&type=` | busca (`q` no título e na descrição, sem diferenciar maiúsculas) e filtros; ordenação por `start_date` |
| `GET /api/activities/:id` | detalhe com horários, instrutor (nome e bio) e `seatsAvailable` |

Cada item traz: `id, title, type, category, instructor{name}, location, startDate, endDate, schedules[], capacity, seatsAvailable, soldOut`.
`seatsAvailable = capacity − inscrições não canceladas`. Até o módulo `enrollments` existir, `seatsAvailable = capacity`. A contagem fica num único método do repositório, que o `enrollments` reutiliza.

**Admin** (`requireAdmin`):
| Rota | Descrição |
|---|---|
| `GET/POST /api/admin/categories`, `PUT /api/admin/categories/:id` | gerenciar categorias |
| `GET/POST /api/admin/instructors`, `GET/PUT /api/admin/instructors/:id` | gerenciar instrutores |
| `GET/POST /api/admin/activities`, `GET/PUT /api/admin/activities/:id` | todas as atividades, de qualquer status; o PUT substitui os horários |
| `POST /api/admin/activities/:id/status` `{ status }` | publicar, voltar para rascunho ou cancelar |

Não há DELETE físico de atividades nem de instrutores na v1. Atividade sai do ar por `cancelled`; instrutor, por `active = 0`.

**Páginas:** `public/index.html` (cards, campo de busca, filtro por categoria, selo "Esgotado"), `public/atividade.html?id=`, `public/admin/atividades.html` (lista + formulário com horários dinâmicos) e `public/admin/instrutores.html`.

## Regras de validação
- `title` com 3 a 120 caracteres; `capacity` inteiro de 1 a 500; `end_date >= start_date`.
- Pelo menos um horário, e cada horário com `start_time < end_time`.
- `category_id` e `instructor_id` precisam existir; o instrutor precisa estar ativo.
- Reduzir `capacity` para menos que o número de inscritos ativos → 409 `CAPACITY_BELOW_ENROLLED`.

## Critérios de aceite
1. A equipe cria uma atividade com 2 horários → 201. O detalhe devolve os 2 horários.
2. Uma atividade em `draft` não aparece em `GET /api/activities` e o detalhe público dá 404. Depois de publicada, aparece.
3. `?q=violão` encontra "Oficina de Violão" (sem diferenciar maiúsculas). `?category=<id>` traz só aquela categoria.
4. A resposta pública não contém `phone` nem `email` do instrutor.
5. `end_date < start_date`, `capacity = 0` ou horário com fim antes do início → 400 com `fields`.
6. Sem sessão, todas as rotas `/api/admin/activities*` → 401.
7. Na página inicial, cada card mostra data, horário, instrutor e vagas disponíveis.

## Verificação
- `npm test -- tests/activities`
- Manual: depois do `db:seed`, filtrar por categoria e buscar na home; criar e publicar uma atividade no admin e vê-la na home.
