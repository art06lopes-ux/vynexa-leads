import type { StatusCampanha, StatusEnvio } from "@/db/tipos";

export const ROTULO_CAMPANHA: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  preparando: "IA escrevendo",
  pronta: "Pronta para revisar",
  agendada: "Agendada",
  enviando: "Enviando",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const COR_CAMPANHA: Record<StatusCampanha, string> = {
  rascunho: "border-white/15 bg-white/5 text-muted-foreground",
  preparando: "border-brilho/35 bg-azul/12 text-[#a9c0ff]",
  pronta: "border-aviso/35 bg-aviso/10 text-aviso",
  agendada: "border-ciano/30 bg-ciano/10 text-ciano",
  enviando: "border-ciano/40 bg-ciano/12 text-ciano",
  pausada: "border-aviso/30 bg-aviso/10 text-aviso",
  concluida: "border-sucesso/30 bg-sucesso/10 text-sucesso",
  cancelada: "border-perigo/25 bg-perigo/10 text-perigo",
};

export const ROTULO_ENVIO: Record<StatusEnvio, string> = {
  pendente: "Pendente",
  preparado: "Preparado",
  agendado: "Agendado",
  enviando: "Enviando",
  enviado: "Enviado",
  entregue: "Entregue",
  aberto: "Aberto",
  clicado: "Clicado",
  respondeu: "Respondeu",
  erro: "Erro",
  cancelado: "Cancelado",
};

export const COR_ENVIO: Record<StatusEnvio, string> = {
  pendente: "text-muted-foreground",
  preparado: "text-[#a9c0ff]",
  agendado: "text-ciano",
  enviando: "text-ciano",
  enviado: "text-foreground",
  entregue: "text-foreground",
  aberto: "text-aviso",
  clicado: "text-[#ff9a5c]",
  respondeu: "text-sucesso",
  erro: "text-perigo",
  cancelado: "text-muted-foreground/70",
};
