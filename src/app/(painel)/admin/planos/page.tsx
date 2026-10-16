import { Gem } from "lucide-react";

import { AbasAdmin } from "@/components/admin/comum";
import { EditorPlanos } from "@/components/admin/editor-planos";
import { Cabecalho } from "@/components/base/cartao";
import { lerConfigSaas, listarMembros } from "@/services/admin";
import { cobrancaDisponivel } from "@/services/assinatura";
import { listarPlanos } from "@/services/contas";
import { exigirDono } from "@/server/sessao";

export const metadata = { title: "Planos" };

export default async function PaginaPlanosAdmin() {
  await exigirDono();
  const [planos, config, membros, cobranca] = await Promise.all([listarPlanos(), lerConfigSaas(), listarMembros(), cobrancaDisponivel()]);
  return (
    <div>
      <Cabecalho icone={Gem} titulo="Planos e teste" trilha={[{ href: "/admin", rotulo: "Painel de membros" }]} descricao="Preço, limites e dias de teste grátis. Mudanças valem na hora para a página de vendas e para quem assinar depois." />
      <AbasAdmin ativa="planos" membros={membros.length} />
      <EditorPlanos planos={planos} config={config} cobrancaPronta={cobranca} />
    </div>
  );
}
