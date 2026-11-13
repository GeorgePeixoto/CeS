# Spec: `enrollments`

> Módulo P0. Depende de: `activities`. Áreas comuns em [SPEC.md](SPEC.md).

## Objetivo
O público faz a pré-inscrição numa atividade sem criar conta, recebe um protocolo e consulta a inscrição depois. O sistema nunca inscreve além do número de vagas. A equipe vê, confirma e cancela inscrições e consulta os participantes.

## Dados pessoais (LGPD: mínimo necessário)
Coletados: **nome**, **telefone** (obrigatório), **e-mail** (opcional) e **data de nascimento** (para saber se é menor de idade e checar a idade mínima). Se a pessoa for menor de 18 anos: **nome e telefone do responsável** e **aceite do responsável** (obrigatórios).
Não coletamos CPF, RG, endereço nem foto. O formulário exibe um aviso curto sobre a finalidade dos dados (organizar as atividades do Núcleo) e exige que a pessoa marque o aceite.

## Modelo de dados (migração `004_enrollments.sql`)
```sql
CREATE TABLE participants (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,          -- só dígitos
  email          TEXT,
  birth_date     TEXT NOT NULL,          -- YYYY-MM-DD
  guardian_name  TEXT,
  guardian_phone TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_participants_phone ON participants(phone);

CREATE TABLE enrollments (
  id               INTEGER PRIMARY KEY,
  activity_id      INTEGER NOT NULL REFERENCES activities(id),
  participant_id   INTEGER NOT NULL REFERENCES participants(id),
  protocol         TEXT NOT NULL UNIQUE,  -- ex.: NMJ-7KQ4XP
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  consent_at       TEXT NOT NULL,         -- aceite dos termos (do responsável, se menor)
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_active_enrollment
  ON enrollments(activity_id, participant_id) WHERE status <> 'cancelled';
```
- **Participante reaproveitado:** procura por `phone` + `name` normalizado (sem acento, minúsculo, espaços colapsados). Se encontrar, reaproveita; senão, cria. Assim, irmãos com o mesmo telefone continuam sendo pessoas diferentes.
- **Protocolo:** `NMJ-` + 6 caracteres aleatórios de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`crypto.randomInt`). Em caso de colisão, gera outro.
- **Vaga ocupada:** qualquer inscrição com `status <> 'cancelled'`.

## Interface

**Pública:**
| Rota | Descrição |
|---|---|
| `POST /api/activities/:id/enrollments` | `{ name, phone, email?, birthDate, guardianName?, guardianPhone?, consent: true }` → 201 `{ data: { protocol, status, activity: { title, startDate, schedules } } }` |
| `GET /api/enrollments/lookup?protocol=&phone=` | 200 com `{ protocol, status, participantName, activity{...} }`; protocolo e telefone que não batem → 404 com a mensagem genérica "Inscrição não encontrada." |

**Erros da pré-inscrição:** 404 se a atividade não existe ou não está publicada; 409 `NO_SEATS`; 409 `ALREADY_ENROLLED`; 409 `ACTIVITY_ENDED` (`end_date` < hoje); 400 `BELOW_MIN_AGE`; 400 `VALIDATION_ERROR` (responsável faltando para menor, consentimento ausente, telefone inválido).

**Concorrência:** a contagem de vagas e o INSERT acontecem dentro de `transaction()` com `BEGIN IMMEDIATE`, então dois pedidos simultâneos pela última vaga nunca são aceitos juntos.

**Admin** (`requireAdmin`):
| Rota | Descrição |
|---|---|
| `GET /api/admin/enrollments?activity=&status=&q=` | lista com participante (nome, telefone, idade, responsável) |
| `POST /api/admin/enrollments/:id/status` `{ status }` | `pending → confirmed`, `pending/confirmed → cancelled`; não reabre uma cancelada (para isso, faz-se nova inscrição) |
| `POST /api/admin/activities/:id/enrollments` | a equipe inscreve alguém presencialmente; mesmas regras, já como `confirmed` |
| `GET /api/admin/participants?q=`, `GET /api/admin/participants/:id` | participante com histórico de inscrições |
| `PUT /api/admin/participants/:id` | corrigir dados cadastrais |

Cancelar libera a vaga na hora. A interface pede confirmação antes de cancelar. Não há exclusão física de participantes na v1 (anonimização fica no BACKLOG).

**Páginas:** formulário em `public/atividade.html` (campos do responsável aparecem quando a data de nascimento indica menor de idade) e tela de sucesso com o protocolo bem visível. Também `public/consulta.html`, `public/admin/inscricoes.html` (filtros por atividade e status, botões Confirmar e Cancelar, inscrição manual) e `public/admin/participantes.html`.

## Critérios de aceite
1. Pré-inscrição válida → 201 com protocolo no formato `NMJ-XXXXXX`, status `pending`. `seatsAvailable` da atividade cai em 1.
2. Atividade com `capacity = 2` e 2 inscrições ativas → a 3ª recebe 409 `NO_SEATS`, e o catálogo mostra `soldOut: true`.
3. 10 pré-inscrições disparadas em paralelo para uma atividade com 3 vagas → exatamente 3 respostas 201 e 7 respostas 409.
4. A mesma pessoa (nome e telefone) na mesma atividade → 409 `ALREADY_ENROLLED`. Depois de cancelar, ela consegue se inscrever de novo.
5. Menor de idade sem os dados do responsável → 400 com `fields.guardianName`. Com os dados → 201.
6. Sem `consent: true` → 400.
7. Lookup com protocolo e telefone corretos → 200. Telefone errado → 404 genérico. A resposta não inclui e-mail, data de nascimento nem dados do responsável.
8. A equipe cancela uma inscrição → a vaga volta a aparecer no catálogo.
9. Sem sessão, todas as rotas `/api/admin/enrollments*` e `/api/admin/participants*` → 401.

## Verificação
- `npm test -- tests/enrollments` (inclui o teste de concorrência do critério 3)
- Manual: inscrever-se até esgotar uma atividade do seed; consultar pelo protocolo; cancelar pelo admin e ver a vaga voltar.
