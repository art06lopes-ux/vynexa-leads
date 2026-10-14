import { ArrowLeft, Radio } from "lucide-react";
import Link from "next/link";

import { AtualizarSozinho } from "@/components/ao-vivo/atualizar-sozinho";
import { GraficoBarras } from "@/components/graficos/graficos";
import { EsculturaV } from "@/components/marca/escultura-v";
import { Contador } from "@/components/motion/contador";
import { lerIdentidade, vendasPagasDoAno } from "@/db/painel";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";

export const metadata = { title: "Ao vivo" };

/**
 * Sala de vendas do dia: o valor vendido hoje em letra grande, a curva
 * por horário contra ontem e os números do dia. Feita para ficar aberta
 * numa tela — atualiza sozinha a cada 30 segundos.
 */

function partes(iso: string, fuso: string): { dia: string; hora: number } {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const hora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", hour12: false }).format(d)) % 24;
  return { dia, hora };
}

export default async function PaginaAoVivo() {
  const [identidade, vendas] = await Promise.all([lerIdentidade(), vendasPagasDoAno()]);
  const fuso = identidade.config.fuso || "America/Manaus";
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  const ontem = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(agora.getTime() - 86_400_000));

  const porHora = Array.from({ length: 24 }, (_, h) => ({ rotulo: `${String(h).padStart(2, "0")}h`, valores: { hoje: 0, ontem: 0 } }));
  let total = 0;
  let custo = 0;
  let qtd = 0;
  let totalOntem = 0;
  const doDia: typeof vendas = [];
  for (const v of vendas) {
    const p = partes(v.pagoEm, fuso);
    if (p.dia === hoje) {
      porHora[p.hora].valores.hoje += v.valor;
      total += v.valor;
      custo += v.custo;
      qtd += 1;
      doDia.push(v);
    } else if (p.dia === ontem) {
      porHora[p.hora].valores.ontem += v.valor;
      totalOntem += v.valor;
    }
  }
  const variacao = totalOntem > 0 ? Math.round(((total - totalOntem) / totalOntem) * 1000) / 10 : null;
  const dataLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric" }).format(agora);

  return (
    <div className="space-y-6">
      <AtualizarSozinho segundos={30} />
      <section className="heroi relative overflow-hidden px-5 pb-10 pt-6 sm:px-10">
        <EsculturaV className="absolute -left-16 -top-24 -z-10 h-[150%] opacity-25" camadas={30} />
        <EsculturaV className="absolute -right-16 -top-24 -z-10 h-[150%] opacity-25" camadas={30} />
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3.5 text-sm font-semibold text-white hover:bg-black/30">
            <ArrowLeft className="size-4" /> Voltar ao Início
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <Radio className="size-3.5" /> Atualiza sozinho
          </span>
        </div>
        <div className="mt-6 text-center">
          <p className="text-[0.72rem] font-semibold text-white/80">Sala de vendas · {identidade.responsavel}</p>
          <h1 className="mt-1 text-[2.2rem] font-semibold tracking-[-0.03em] text-white sm:text-[3rem]">Vendas hoje</h1>
          <p className="text-sm text-white/80">{dataLonga}</p>
        </div>
        <div className="mx-auto mt-6 max-w-2xl rounded-3xl border border-white/15 bg-black/35 px-6 py-7 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm">
          <p className="text-[0.72rem] font-semibold text-white/70">Valor vendido e pago hoje</p>
          <Contador valor={total} formato="moeda" duracao={1.6} className="mt-2 block font-display text-[3.2rem] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[5rem]" />
          <p className="mt-3 text-sm text-white/80">
            {variacao === null ? (totalOntem === 0 && total > 0 ? "Ontem não teve venda — hoje já tem." : "Sem vendas ontem para comparar.") : `${variacao >= 0 ? "+" : ""}${variacao.toLocaleString("pt-BR")}% em relação a ontem (${formatarDinheiro(totalOntem)})`}
          </p>
        </div>
      </section>

      <section className="placa p-5 sm:p-6" aria-labelledby="titulo-tendencia">
        <h2 id="titulo-tendencia" className="text-xl font-semibold">
          Tendência de vendas
        </h2>
        <p className="text-sm text-muted-foreground">Vendas pagas ao longo do dia, comparadas com ontem.</p>
        <div className="mt-4">
          <GraficoBarras
            dados={porHora}
            series={[
              { chave: "hoje", rotulo: "Hoje", cor: "#ff5a1f" },
              { chave: "ontem", rotulo: "Ontem", cor: "#6b5d50" },
            ]}
            formato="moeda"
            altura={220}
            destacarUltimo={false}
            titulo="Vendas por horário"
          />
        </div>
      </section>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Vendas pagas hoje", <Contador key="q" valor={qtd} className="font-display text-3xl font-semibold" />],
          ["Ticket médio", <Contador key="t" valor={qtd ? Math.round(total / qtd) : 0} formato="moeda" className="font-display text-3xl font-semibold" />],
          ["Lucro do dia", <Contador key="l" valor={total - custo} formato="moeda" className="font-display text-3xl font-semibold" />],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="placa p-5 text-center">
            <dt className="text-xs font-semibold text-muted-foreground">{rotulo}</dt>
            <dd className="mt-1">{valor}</dd>
          </div>
        ))}
      </dl>

      {doDia.length > 0 && (
        <section className="placa p-5">
          <h2 className="font-semibold">Vendas de hoje</h2>
          <ul className="mt-3 divide-y divide-fio">
            {doDia.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <b>{v.cliente ?? v.descricao}</b> <span className="text-muted-foreground">· {v.descricao}</span>
                </span>
                <span className="valor-sensivel shrink-0 font-semibold num">{formatarDinheiro(v.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
