import type { Empresa } from "@/db/tipos";
import { statusPresenca } from "@/services/qualidade-site";

/**
 * Diagnóstico escrito por regra, sem IA — aparece no perfil antes de
 * qualquer análise. Cada frase vem de um campo preenchido; campo vazio
 * não vira frase. A versão da IA (LeadAnalyzer) substitui esta quando
 * existe.
 */
export function diagnosticoPorRegra(e: Pick<Empresa, "avaliacao_nota" | "avaliacao_qtd" | "status_site" | "site_qualidade" | "whatsapp" | "email" | "instagram">): string {
  const partes: string[] = [];
  const reputacao =
    e.avaliacao_nota !== null && e.avaliacao_qtd
      ? e.avaliacao_nota >= 4.3
        ? `Esta empresa possui boa reputação no Google (nota ${e.avaliacao_nota.toFixed(1).replace(".", ",")} em ${e.avaliacao_qtd} avaliações)`
        : `Esta empresa tem nota ${e.avaliacao_nota.toFixed(1).replace(".", ",")} em ${e.avaliacao_qtd} avaliações no Google`
      : null;
  const comReputacao = (resto: string, semReputacao: string) => (reputacao ? `${reputacao}, ${resto}` : semReputacao);
  const vitrine = e.avaliacao_qtd ? "serviços, localização, avaliações e botão direto para WhatsApp" : "serviços, localização e botão direto para WhatsApp";

  switch (statusPresenca(e.status_site, e.site_qualidade)) {
    case "sem_site":
      partes.push(`${comReputacao("mas não encontramos um site próprio.", "Não encontramos um site próprio para esta empresa.")} Isso representa uma oportunidade para apresentar uma página profissional com ${vitrine}.`);
      break;
    case "rede_social":
      partes.push(`${comReputacao("mas a presença encontrada é só em redes sociais, sem site próprio.", "A presença encontrada desta empresa é só em redes sociais, sem site próprio.")} Um site com domínio próprio dá endereço fixo para clientes e para o Google.`);
      break;
    case "fraco":
    case "fora_do_ar":
      partes.push(`${comReputacao("e o site encontrado tem problemas (veja a avaliação do site).", "O site encontrado desta empresa tem problemas (veja a avaliação do site).")} Há espaço claro para uma versão moderna, rápida e adaptada ao celular.`);
      break;
    case "bom":
      partes.push(`${comReputacao("e o site encontrado é funcional, com pontos a melhorar.", "O site desta empresa é funcional, com pontos a melhorar.")} A abordagem deve ser sobre melhorias específicas, não sobre "ter um site".`);
      break;
    case "excelente":
      partes.push(`${comReputacao("e o site já é profissional.", "O site desta empresa já é profissional.")} A oportunidade, se houver, está em sistema ou automação — não em site.`);
      break;
    case "nao_avaliado":
      partes.push(`${reputacao ? `${reputacao}. ` : ""}Tem site, ainda não avaliado — a visita automática ao site define a qualidade.`);
      break;
    default:
      partes.push(`${reputacao ? `${reputacao}. ` : ""}A fonte não trouxe site nem contato: é preciso pesquisar o contato antes de abordar.`);
  }

  const canais = [e.whatsapp === 1 && "WhatsApp", e.email && "e-mail", e.instagram && "Instagram"].filter(Boolean) as string[];
  if (canais.length > 0) partes.push(`Canais disponíveis: ${canais.join(", ")}.`);
  return partes.join(" ");
}
