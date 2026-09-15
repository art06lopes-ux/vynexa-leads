# Vynexa Leads

Plataforma de prospecção comercial da **Vynexa**. Encontra empresas com
presença digital fraca — sem site, ou só com rede social —, guarda o que
achou e prepara a abordagem por WhatsApp (Brasil) ou e-mail
(internacional).

Roda inteira em plano gratuito, **sem cartão de crédito em serviço
nenhum**.

## Como funciona

A Vercel não aguenta o trabalho pesado: função do plano Hobby é cortada em
10 segundos e uma consulta à Overpass leva de 5 a 60. Daí a arquitetura em
duas metades:

```
  navegador
     │  POST /api/buscas
     ▼
  Next.js na Vercel ──────► Turso  ◄────── GitHub Actions (cron 5 min)
     │  cria o job              ▲              │  pega o job pendente
     │  e responde na hora      │              │  consulta Nominatim + Overpass
     ▼                          └──────────────┘  grava as empresas
  polling do status
```

A rota de API nunca chama a Overpass. Ela cria um job e devolve; o worker
no GitHub Actions faz a consulta com o tempo que precisar.

## Regras que o código respeita

- **Nada de dado inventado.** Telefone, e-mail, site e rede social só
  entram se vierem de uma fonte consultada. Campo não encontrado fica
  nulo, e a interface diz que está faltando em vez de deixar em branco.
- **Sem scraping ilegal.** As fontes são a Overpass API, o Nominatim e a
  API de Localidades do IBGE. O Instagram e o Facebook das empresas vêm
  das tags do próprio OpenStreetMap — a ferramenta não visita as redes.
- **Sem completar resultado.** Se a região tem 32 empresas do segmento, o
  resultado é 32, com o número à mostra.
- **O Google Maps não aparece em lugar nenhum**: raspar viola os termos, e
  a Places API pede cartão.

## Stack

| Camada | Escolha |
| --- | --- |
| IA | Gemini `gemini-3.5-flash-lite`, free tier |
| Aplicação | Next.js 16 (App Router) + TypeScript |
| Interface | Tailwind CSS v4 + shadcn/ui |
| Banco | Turso (libSQL) — em desenvolvimento, um arquivo SQLite local |
| Worker | GitHub Actions, cron de 5 minutos |
| Empresas | OpenStreetMap — Overpass API + Nominatim |
| Contato (Brasil) | Dados abertos do CNPJ — Receita Federal, importados por mês |
| Localidades BR | API de Localidades do IBGE |
| Acesso | senha única em cookie assinado com HMAC |
| Hospedagem | Vercel, plano Hobby |

## Começando

Ver **[docs/SETUP.md](docs/SETUP.md)**. Para rodar local não é preciso
criar conta em nada:

```bash
cp .env.example .env.local   # TURSO_DATABASE_URL=file:./local.db
npm install
npm run db:aplicar
npm run dev                  # http://localhost:3100
npm run worker               # processa a fila, noutro terminal
```

`npm run check` roda lint, typecheck e build.

## Estado

| Etapa | Situação |
| --- | --- |
| **1 — Núcleo de busca e visualização** | **pronta** |
| Schema do Turso e migrações | pronto |
| Login por senha | pronto |
| Busca Brasil (IBGE) e internacional | pronto |
| Worker com fila, lease, backoff e expansão de raio | pronto |
| Dashboard com contadores | pronto |
| Listagem com filtros e paginação | pronto |
| Exportação CSV | pronto |
| **2 — Inteligência (Gemini)** | implementada, falta verificar |
| Análise por IA: score, motivo e mensagem | escrito, sem chamada real ainda |
| Link `wa.me` com a mensagem pronta | pronto |
| Filtros de oportunidade e canal | pronto |
| Vendas: registro manual (Pix, transferência, dinheiro) | pronto |
| Vendas: checkout por cartão via Stripe + webhook | verificado em modo teste |
| PWA instalável + push de venda no celular | pronto, falta ativar por aparelho |
| **3 — Campanhas de e-mail (Gmail)** | implementada; envio real depende das credenciais OAuth |
| E-mail do site da empresa (robots.txt respeitado) | pronto |
| Campanha: seleção, e-mail por IA no idioma do lead, fila com teto diário | pronto |
| WhatsApp direto em cada linha | pronto |
| **4 — Receita Federal como fonte de contato** | implementada; primeira importação pendente |
| Importador mensal no GitHub Actions (fluxo, sem guardar os 17 GB) | pronto, testado com um arquivo real |
| Caçada casa OSM × Receita por nome e preenche telefone/e-mail com origem | pronto |
| Site conferido pelo domínio do e-mail (robots.txt respeitado) | pronto |

O cliente do Gemini foi escrito a partir da documentação — endpoint
`/v1beta/interactions`, saída em `output_text` —, mas nenhuma chamada real
foi feita ainda, porque exige uma chave. Enquanto isso não acontecer, a
Etapa 2 é código que compila, não código comprovado.

As tabelas `campanhas`, `campanha_leads` e `envios` já existem no banco,
com os campos da Etapa 3, mas o handler `envio_email` ainda não existe e
falha de propósito se for chamado — melhor do que marcar como concluído
em silêncio.
