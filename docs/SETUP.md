# Setup

Passo a passo para deixar o Vynexa Leads rodando. **Nenhuma etapa exige
cartão de crédito.** As três premissas de custo foram conferidas na
documentação oficial antes de o projeto ser escrito — ver
[Limites gratuitos](#limites-gratuitos-e-por-que-o-repositório-é-público)
no fim deste arquivo.

---

## 1. Rodar local, sem conta em serviço nenhum

O `libsql` é o mesmo motor do SQLite. Apontando a URL para um arquivo,
tudo funciona offline — o que roda no arquivo roda no Turso sem alterar
uma linha.

```bash
cp .env.example .env.local
```

Preencha só três campos para começar:

```
TURSO_DATABASE_URL=file:./local.db
SENHA_PAINEL=a-senha-que-voce-quiser
SEGREDO_SESSAO=<cole a saída do comando abaixo>
```

Gere o segredo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Então:

```bash
npm install
npm run db:aplicar
npm run dev
```

Abra <http://localhost:3100>. A porta é 3100 de propósito, para não
brigar com outros projetos que usam a 3000.

Para processar a fila de buscas na sua máquina, em outro terminal:

```bash
npm run worker
```

---

## 2. Turso (banco de produção)

1. <https://turso.tech> → crie a conta com o GitHub. **Não pede cartão.**
2. Crie um banco. Região: escolha a mais próxima de você.
3. Copie a URL (`libsql://<banco>-<org>.turso.io`) e gere um token.
4. Preencha `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` no `.env.local`.
5. `npm run db:aplicar` — agora as migrações vão para o Turso.

O free inclui 5 GB, 500 milhões de linhas lidas e 10 milhões escritas por
mês. Uma carteira de dezenas de milhares de empresas não chega perto
disso. Cartão só é pedido se você quiser habilitar cobrança por excedente,
e isso é opcional.

---

## 3. GitHub — repositório e worker

O repositório precisa ser **público**. Não é preferência: é o que torna o
cron de 5 minutos gratuito. Ver a explicação no fim deste arquivo.

```bash
git add -A
git commit -m "Etapa 1: núcleo de busca e visualização"
gh repo create vynexa-leads --public --source=. --push
```

Depois, em **Settings → Secrets and variables → Actions → New repository
secret**, cadastre três segredos:

| Segredo | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | a URL `libsql://…` do passo 2 |
| `TURSO_AUTH_TOKEN` | o token do passo 2 |
| `OSM_CONTATO` | seu e-mail |
| `GEMINI_API_KEY` | a chave do passo 3.1 |

O workflow está em `.github/workflows/worker.yml`. Ele roda a cada 5
minutos e também pode ser disparado à mão em **Actions → worker → Run
workflow**, o que é a forma mais rápida de testar.

> **Atenção:** o GitHub desativa workflows agendados após **60 dias sem
> nenhuma atividade no repositório**. Um commit qualquer reativa. Se um
> dia as buscas pararem de sair da fila sem erro nenhum, é isto.

---

## 3.1 Chave do Gemini (análise de IA)

1. <https://aistudio.google.com/apikey> → **Create API key**. Entra com a
   conta Google, **não pede cartão nem projeto no Google Cloud**.
2. Copie a chave e cadastre como o segredo `GEMINI_API_KEY` no GitHub.
3. Para rodar a análise na sua máquina, coloque também no `.env.local`.

A chave é usada **só pelo worker**. O site não fala com o Gemini, então
ela não entra nas variáveis da Vercel — é uma credencial a menos exposta.

Modelo usado: `gemini-3.5-flash-lite`, que está no free tier. Os modelos
Pro saíram do plano gratuito e não são usados neste projeto.

## 3.2 Stripe (checkout)

**Comece pelo modo de teste.** A chave `sk_test_` aceita cartões
fictícios e não move dinheiro nenhum — o painel mostra um aviso amarelo
enquanto ela estiver ativa.

1. <https://dashboard.stripe.com> → criar conta. **Aceita CPF**, não
   exige CNPJ, e não pede cartão de crédito.
2. **Developers → API keys** → copie a **Secret key** (`sk_test_…`).
3. Cadastre na Vercel como `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://SEU-PROJETO.vercel.app/api/webhooks/stripe`
   - Evento: `checkout.session.completed`
5. Copie o **Signing secret** (`whsec_…`) e cadastre como
   `STRIPE_WEBHOOK_SECRET`.
6. Redeploy.

Sem o passo 4 e 5 os links funcionam e o cliente paga, mas a venda fica
como "Aguardando" para sempre: é o webhook que confirma.

### Custo

A Stripe **não cobra mensalidade nem taxa de instalação**. Cobra por
transação: **cartão nacional 3,99% + R$ 0,39**, Pix 1,19% (liberado por
convite), boleto R$ 3,45. Numa venda de R$ 1.297 no cartão, a taxa fica
em torno de R$ 52. Valores conferidos em <https://stripe.com/br/pricing>.

### O que este projeto não faz

Não existe campo de cartão em lugar nenhum da aplicação, e não vai
existir. O cliente é levado à página de checkout da Stripe, que é
certificada para isso. Guardar dado de cartão aqui traria escopo de PCI
sem nenhum ganho.

## 4. Vercel

1. <https://vercel.com> → **Add New** → **Project** → importe o repositório.
   O plano Hobby não pede cartão.
2. Em **Environment Variables**, cadastre:

   | Variável | Valor |
   | --- | --- |
   | `TURSO_DATABASE_URL` | a mesma do GitHub |
   | `TURSO_AUTH_TOKEN` | o mesmo do GitHub |
   | `SENHA_PAINEL` | a senha do painel |
   | `SEGREDO_SESSAO` | o segredo de 64 caracteres |
   | `OSM_CONTATO` | seu e-mail |
   | `STRIPE_SECRET_KEY` | a chave do passo 3.2 |
   | `STRIPE_WEBHOOK_SECRET` | o signing secret do passo 3.2 |

3. Deploy.

O worker **não** roda na Vercel. Funções do plano Hobby são cortadas em
10 segundos e uma consulta à Overpass leva de 5 a 60 — por isso a rota
`/api/buscas` só enfileira e devolve na hora, e quem faz o trabalho é o
GitHub Actions.

Trocar `SEGREDO_SESSAO` derruba todas as sessões abertas. É o jeito de
expulsar alguém que tenha ficado com o cookie.

---

## Limites gratuitos e por que o repositório é público

| Serviço | Cartão? | Limite relevante |
| --- | --- | --- |
| Turso | Não | 5 GB · 500M linhas lidas/mês · 10M escritas/mês |
| Vercel Hobby | Não | 100 GB de banda/mês · função cortada em 10s |
| GitHub Actions | Não | **público: ilimitado** · privado: 2.000 min/mês |
| Overpass API | Não | sem cota fixa; entra em fila quando carregada |
| Nominatim | Não | 1 requisição por segundo, com cache obrigatório |
| Gemini | Não | Flash e Flash-Lite seguem no free tier; Pro saiu em abril/2026 |

**A conta do cron.** No plano Free, cada execução do Actions é cobrada
arredondada para cima ao minuto inteiro. Um cron de 5 minutos são 8.640
execuções por mês — ou seja, no mínimo 8.640 minutos, contra os 2.000
inclusos em repositório privado. Nem um cron de 10 minutos caberia
(4.320). Em repositório público os runners padrão são gratuitos e
ilimitados, e é isso que faz os 5 minutos serem viáveis a custo zero.

Nada sensível fica no repositório: os leads estão no Turso, e as
credenciais em GitHub Secrets e nas variáveis da Vercel.

**O agendamento é best effort.** O GitHub não garante pontualidade e
atrasa em horário de pico. "A cada 5 minutos" é, na prática, "no mínimo
a cada 5 minutos".

---

## Sobre as fontes de dados

- **Overpass API e Nominatim** exigem um `User-Agent` que identifique a
  aplicação e um contato alcançável. É para isso que serve `OSM_CONTATO`;
  sem ele, o bloqueio vem sem aviso.
- O Nominatim limita a **1 requisição por segundo** e exige cache. Os dois
  estão implementados em `src/lib/osm/limitador.ts` e no cache de processo
  do `src/lib/osm/nominatim.ts`.
- **Nada de scraping de rede social.** O Instagram e o Facebook que
  aparecem nas empresas vêm das tags `contact:instagram` e
  `contact:facebook` do próprio OpenStreetMap, que são dados públicos e
  abertos. A ferramenta não visita essas plataformas.
- **O Google Maps não é usado em lugar nenhum.** Raspar viola os termos de
  uso, e a Places API exige cartão mesmo na cota gratuita.
- As colunas `avaliacao_nota` e `avaliacao_qtd` existem no banco mas ficam
  sempre nulas: o OpenStreetMap não guarda avaliações, e não há fonte
  gratuita e legítima para elas hoje. Preenchê-las com estimativa seria
  inventar dado, o que o projeto proíbe.
