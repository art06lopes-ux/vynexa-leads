# Vynexa Leads como SaaS

## Como funciona

- **Cada assinante tem um banco próprio** (Cloudflare D1 criado no cadastro). A conta do dono (`principal`) usa o banco de sempre, que também guarda o controle do SaaS: `contas`, `usuarios`, `planos`, `faturas`, `uso_contas`, `redefinicoes_senha`.
- `getBanco()` descobre a conta pelo cookie de sessão (ou por `comConta()` no worker e nos webhooks) e devolve o banco dela. Nenhuma consulta precisou mudar.
- **Planos**: o que cada plano libera está em `src/lib/planos.ts`. Preço, limites e dias de teste mudam pelo painel (Admin → Planos e teste).
- **Cobrança**: assinatura mensal no Asaas do dono (`src/services/assinatura.ts`). O webhook `/api/webhooks/asaas` (sem `?conta=`) separa a assinatura do SaaS (`externalReference = saas:<conta>:<plano>`) das vendas do dono.
- **Chaves**: o assinante nunca herda as chaves do dono, exceto a do Gemini (a "IA da Vynexa", com limite mensal por plano). O Google Maps usa a chave do próprio assinante (PRO e Agência).
- **Worker** (GitHub Actions): atende a fila de todas as contas com acesso liberado, um job de cada por volta.

## Para ligar em produção

1. **Token da Cloudflare com permissão de criar banco.** Em dash.cloudflare.com → My Profile → API Tokens, edite o token usado no `CLOUDFLARE_API_TOKEN` e confirme a permissão **Account → D1 → Edit**. Sem ela, o cadastro funciona, mas a conta fica "banco não criado": você recebe o aviso e pode tentar de novo pelo painel do membro.
2. **Limite do plano grátis do D1:** são 10 bancos (o seu + 9 clientes) e 100 mil escritas por dia somando todos. Antes do 10º cliente, assine o **Workers Paid (US$ 5/mês)**: passa para 50 mil bancos e 50 milhões de escritas por mês.
3. **Asaas:** siga o tutorial "Ligar a cobrança das assinaturas", que só o dono vê, em Tutoriais. Resumo:
   - cole a chave de produção;
   - mude o ambiente para Produção;
   - crie o token do webhook;
   - cadastre o webhook com os eventos `PAYMENT_*` e `SUBSCRIPTION_*`.
4. **Admin → Planos e teste:** confira os preços, defina os dias de teste e o WhatsApp do suporte.
5. **Seu login agora é e-mail + senha.** No primeiro login, use o seu e-mail com a senha do painel (`SENHA_PAINEL`). Esse e-mail vira o administrador. A sessão que já estava aberta continua valendo.
6. **E-mail do sistema** (link de senha nova): sai pelo provedor de e-mail configurado na sua conta (Configurações → E-mail).

## Depois de mudar o esquema

Sempre que entrar migração nova em `db/migracoes`, gere de novo o esquema com que nascem os bancos dos assinantes:

```bash
npx tsx scripts/gerar-esquema-conta.ts
```

As migrações automáticas (`src/db/esquema-auto.ts`) já rodam sozinhas em cada banco de assinante na primeira vez que ele é usado.
