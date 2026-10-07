import { Bell } from "lucide-react";

import { Cabecalho } from "@/components/base/cartao";
import { ListaNotificacoes } from "@/components/shell/lista-notificacoes";

export const metadata = { title: "Notificações" };

export default function PaginaNotificacoes() {
  return (
    <div>
      <Cabecalho icone={Bell} titulo="Notificações" descricao="Vendas, pagamentos, respostas, campanhas e oportunidades — atualizado a cada poucos segundos." />
      <ListaNotificacoes />
    </div>
  );
}
