# Sistema de Gestão de Oficinas — Núcleo Marcus Jussier

Plataforma web para divulgação da programação cultural, pré-inscrição pública com controle atômico de vagas, consulta por protocolo, gestão administrativa, registro de presença e relatórios de ocupação e frequência.

## Stack

- **Runtime:** Node.js v26+ (ESM nativo, `node:sqlite`, `node:test`)
- **Backend:** Express 5 + `express-session` + `bcryptjs`
- **Banco de Dados:** SQLite embutido (`data/nucleo.db`) com migrações SQL sequenciais
- **Frontend:** HTML5, CSS3 mobile-first e JavaScript modular puro (Chart.js 4.4.1 nos relatórios)

## Configuração inicial

1. Instale as dependências:
```bash
npm install
```

## Crie o arquivo .env na raiz do projeto:

```bash
Snippet de código


PORT=3000
SESSION_SECRET=nucleo_marcus_jussier_local_2026
DB_PATH=data/nucleo.db
NODE_ENV=development
TZ=America/Fortaleza

```

## Aplique as migrações e crie o usuário administrador:

```bash
npm run db:migrate
npm run admin:create -- --email admin@nucleo.local --name "Equipe"
```

## Popule o catálogo inicial (idempotente):

```bash
npm run db:seed
```

## Inicie o servidor:

```bash
npm start
```

## Acesse http://localhost:3000 para o catálogo público e http://localhost:3000/admin/login.html para o painel administrativo.


## Estrutura do projeto

```bash

├── scripts/
│   ├── create-admin.js      # Criação de usuário administrativo via CLI
│   ├── migrate.js           # Executor de migrações SQL
│   └── seed.js              # Carga inicial idempotente de dados
├── src/
│   ├── app.js               # Configuração do Express, sessão e rotas
│   ├── server.js            # Ponto de entrada HTTP
│   ├── db/
│   │   ├── connection.js    # Conexão node:sqlite (WAL, FK, BEGIN IMMEDIATE)
│   │   ├── migrate.js       # Controle de versão de schema
│   │   └── migrations/      # 001 a 005 (sessões, admin, atividades, inscrições, presença)
│   ├── lib/
│   │   ├── dates.js         # Cálculos de data/idade no fuso America/Fortaleza
│   │   ├── errors.js        # Classes HttpError padronizadas
│   │   ├── http.js          # Headers de segurança e tratamento global de erros
│   │   └── validation.js    # Validadores de entrada
│   └── modules/
│       ├── admin-auth/      # Login, logout, sessão e rate limit
│       ├── activities/      # Categorias, instrutores, atividades e catálogo público
│       ├── enrollments/     # Pré-inscrição atômica, protocolo NMJ-XXXXXX e participantes
│       ├── attendance/      # Cálculo de encontros e registro de chamada
│       └── reports/         # Indicadores agregados de ocupação e frequência
├── public/                  # Páginas HTML, CSS e scripts ES modules do cliente
└── tests/                   # Testes automatizados por módulo (node:test)
```

## Roteiro de Demonstração (Demo)

**1. Catálogo público (/):** 
filtrar atividades por categoria (Música, Teatro, Dança, Artes Visuais), buscar por termo (violão) e abrir os detalhes de Xilogravura e Gravura em Relevo (2 vagas).

**2. Pré-inscrição (/atividade.html):**
*Preencher dados de um participante menor de 18 anos para demonstrar a exibição automática dos campos do responsável legal e o termo de consentimento (LGPD).

*Concluir a pré-inscrição e copiar o protocolo NMJ-XXXXXX.

*Realizar a 2ª inscrição para mostrar o bloqueio imediato das vagas (Esgotado).

**3. Consulta pública (/consulta.html):**
consultar a situação usando o protocolo gerado e o telefone cadastrado.

**4. Painel administrativo (/admin/login.html):**
*nscrições (/admin/inscricoes.html): confirmar uma inscrição pendente e cancelar outra, mostrando a vaga voltando automaticamente ao catálogo público.

*Atividades (/admin/atividades.html): criar uma nova atividade com horários semanais e publicá-la.

*Chamada (/admin/presenca.html): selecionar uma atividade com encontros realizados, marcar presença dos inscritos confirmados e salvar.

*Relatórios (/admin/relatorios.html): visualizar os cartões de totais, os gráficos comparativos e ordenar a tabela por ocupação e frequência.


```bash

---

### 3. Preparar o ambiente limpo para o ensaio final (PowerShell)
Execute a sequência abaixo no **PowerShell** para recriar o banco do zero, criar o usuário admin, rodar o seed, validar toda a suíte de testes e subir o servidor para percorrer o roteiro no navegador:

```powershell
# 1. Remover banco antigo para ensaio limpo
Remove-Item data/nucleo.db* -ErrorAction SilentlyContinue

# 2. Aplicar todas as migrações (001 a 005), criar admin e popular seed
npm run db:migrate
npm run admin:create -- --email admin@nucleo.local --name "David"
npm run db:seed

# 3. Validar toda a suíte de testes e lint
npm test
npm run check

# 4. Iniciar o servidor para percorrer o roteiro da demo no navegador
npm start