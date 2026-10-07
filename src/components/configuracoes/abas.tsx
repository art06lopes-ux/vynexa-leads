"use client";

import { motion } from "framer-motion";
import { Archive, Check, Copy, KeyRound, LoaderCircle, Plus, Send, Trash2, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Marca } from "@/components/marca";
import type { EstadoSegredo } from "@/integrations/segredos";
import { formatarDinheiro } from "@/lib/pagamento/dinheiro";
import { cn } from "@/lib/utils";
import {
  adicionarSupressao,
  apagarChave,
  arquivarProduto,
  criarCatalogoInicial,
  enviarLogo,
  removerLogo,
  salvarChave,
  salvarConfiguracoes,
  salvarProduto,
  tirarDaSupressao,
  type Resultado,
} from "@/server/acoes-configuracoes";

const campo = "h-10 w-full rounded-xl border border-fio bg-white/[0.03] px-3 text-sm outline-none focus:border-brilho/60";
const botaoPrimario = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-azul px-4 text-sm font-semibold text-white hover:bg-brilho disabled:opacity-60";

function avisar(r: Resultado) {
  if (r.ok) toast.success(r.mensagem);
  else toast.error(r.mensagem);
}

export const ABAS = [
  { chave: "identidade", rotulo: "Identidade" },
  { chave: "produtos", rotulo: "Produtos" },
  { chave: "integracoes", rotulo: "Integrações" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "pagamentos", rotulo: "Pagamentos" },
  { chave: "compliance", rotulo: "Não contatar" },
  { chave: "avancado", rotulo: "Avançado" },
] as const;

export function SeletorAbas() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const atual = params.get("aba") ?? "identidade";
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-fio px-4 sm:mx-0 sm:px-0" role="tablist">
      {ABAS.map((a) => (
        <button
          key={a.chave}
          type="button"
          role="tab"
          aria-selected={atual === a.chave}
          onClick={() => router.replace(`${pathname}?aba=${a.chave}`, { scroll: false })}
          className={cn("relative h-11 shrink-0 cursor-pointer px-3.5 text-sm font-medium", atual === a.chave ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {a.rotulo}
          {atual === a.chave && <motion.span layoutId="aba-config" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ciano" />}
        </button>
      ))}
    </nav>
  );
}

/** Formulário genérico de chaves de configuração (server action). */
export function FormConfig({ children, className }: { children: React.ReactNode; className?: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <form
      className={cn("space-y-4", className)}
      action={(form) =>
        iniciar(async () => {
          avisar(await salvarConfiguracoes(form));
          router.refresh();
        })
      }
    >
      {children}
      <button type="submit" disabled={pendente} className={botaoPrimario}>
        {pendente ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
      </button>
    </form>
  );
}

export function Campo({ nome, rotulo, valor, tipo = "text", dica, placeholder, linhas }: { nome: string; rotulo: string; valor?: string; tipo?: string; dica?: string; placeholder?: string; linhas?: number }) {
  return (
    <label className="block space-y-1.5">
      <span className="rotulo">{rotulo}</span>
      {linhas ? (
        <textarea name={nome} defaultValue={valor} rows={linhas} placeholder={placeholder} className="w-full rounded-xl border border-fio bg-white/[0.03] p-3 text-sm outline-none focus:border-brilho/60" />
      ) : (
        <input name={nome} type={tipo} defaultValue={valor} placeholder={placeholder} className={tipo === "color" ? "h-10 w-20 cursor-pointer rounded-xl border border-fio bg-transparent p-1" : campo} />
      )}
      {dica && <span className="block text-xs text-muted-foreground">{dica}</span>}
    </label>
  );
}

export function UploadLogo({ logoUrl, empresa }: { logoUrl: string | null; empresa: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 min-w-40 items-center justify-center rounded-2xl border border-fio bg-white/[0.03] px-5">
        <Marca logoUrl={logoUrl} nome={empresa.split(" ")[0]} sufixo={null} />
      </div>
      <form
        action={(form) =>
          iniciar(async () => {
            avisar(await enviarLogo(form));
            router.refresh();
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" required className="text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:text-foreground" />
        <button type="submit" disabled={pendente} className={botaoPrimario}>
          {pendente ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar logo
        </button>
        {logoUrl && (
          <button type="button" disabled={pendente} onClick={() => iniciar(async () => { avisar(await removerLogo()); router.refresh(); })} className="h-10 cursor-pointer rounded-xl border border-fio px-3 text-sm text-muted-foreground hover:text-perigo">
            Remover
          </button>
        )}
      </form>
      <p className="w-full text-xs text-muted-foreground">PNG, JPG, WebP ou SVG, até 300 KB. Sem logo, usamos o monograma provisório — o logo real nunca é recriado em texto.</p>
    </div>
  );
}

export function CampoSegredo({ s, ajuda }: { s: EstadoSegredo; ajuda?: React.ReactNode }) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <div className="rounded-xl border border-fio p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <p className="font-semibold">{s.rotulo}</p>
        <span className={cn("ml-auto rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", s.configurado ? "border-sucesso/30 bg-sucesso/10 text-sucesso" : "border-white/15 text-muted-foreground")}>
          {s.configurado ? `Configurada · ••••${s.final ?? ""}${s.origem === "ambiente" ? " (variável de ambiente)" : ""}` : "Não configurada"}
        </span>
      </div>
      {ajuda && <div className="mt-1.5 text-xs text-muted-foreground">{ajuda}</div>}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await salvarChave(s.nome, valor);
            avisar(r);
            if (r.ok) setValor("");
            router.refresh();
          });
        }}
      >
        <input type="password" autoComplete="off" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={s.configurado ? "Colar uma nova chave para substituir" : "Colar a chave"} className={cn(campo, "min-w-56 flex-1")} aria-label={s.rotulo} />
        <button type="submit" disabled={pendente || valor.trim().length < 8} className={botaoPrimario}>
          Salvar
        </button>
        {s.origem === "tela" && (
          <button type="button" disabled={pendente} onClick={() => window.confirm(`Remover a chave ${s.rotulo}?`) && iniciar(async () => { avisar(await apagarChave(s.nome)); router.refresh(); })} className="flex size-10 cursor-pointer items-center justify-center rounded-xl border border-fio text-muted-foreground hover:text-perigo" aria-label="Remover chave">
            <Trash2 className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}

type Produto = { id: string; nome: string; tipo: string | null; descricao: string | null; entregaveis: string | null; preco_centavos: number; ordem: number; ativo: number };

export function Produtos({ produtos }: { produtos: Produto[] }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const formulario = (p?: Produto) => (
    <form
      key={p?.id ?? "novo"}
      className="grid gap-3 rounded-xl border border-brilho/30 bg-azul/[0.05] p-4 sm:grid-cols-2"
      action={(form) =>
        iniciar(async () => {
          const r = await salvarProduto(form);
          avisar(r);
          if (r.ok) setEditando(null);
          router.refresh();
        })
      }
    >
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="space-y-1">
        <span className="rotulo">Nome</span>
        <input name="nome" required defaultValue={p?.nome} className={campo} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 space-y-1">
          <span className="rotulo">Tipo</span>
          <select name="tipo" defaultValue={p?.tipo ?? "site"} className={cn(campo, "cursor-pointer")}>
            <option value="site">Site</option>
            <option value="agendamento">Agendamento</option>
            <option value="sistema">Sistema</option>
            <option value="app">Aplicativo</option>
            <option value="saas">SaaS</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="rotulo">Ordem</span>
          <input name="ordem" type="number" defaultValue={p?.ordem ?? 0} className={campo} />
        </label>
      </div>
      <label className="space-y-1">
        <span className="rotulo">Preço (R$) — 0 = a combinar</span>
        <input name="preco" inputMode="decimal" defaultValue={p ? String(p.preco_centavos / 100).replace(".", ",") : ""} className={campo} />
      </label>
      <label className="space-y-1">
        <span className="rotulo">Descrição</span>
        <input name="descricao" defaultValue={p?.descricao ?? ""} className={campo} />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="rotulo">Entregáveis (um por linha — a proposta usa só estes)</span>
        <textarea name="entregaveis" rows={4} defaultValue={p?.entregaveis ?? ""} className="w-full rounded-xl border border-fio bg-white/[0.03] p-3 text-sm outline-none focus:border-brilho/60" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pendente} className={botaoPrimario}>
          Salvar produto
        </button>
        <button type="button" onClick={() => setEditando(null)} className="h-10 cursor-pointer rounded-xl border border-fio px-4 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">A IA escolhe, para cada lead, o produto mais adequado desta lista — e nunca inventa outro. O preço vem daqui, não da IA.</p>
      {produtos.length === 0 && (
        <button type="button" disabled={pendente} onClick={() => iniciar(async () => { avisar(await criarCatalogoInicial()); router.refresh(); })} className={botaoPrimario}>
          Criar catálogo inicial (Site Essencial, Profissional, Premium…)
        </button>
      )}
      {produtos.map((p) =>
        editando === p.id ? (
          formulario(p)
        ) : (
          <div key={p.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-fio p-4", !p.ativo && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.nome} <span className="text-xs font-normal text-muted-foreground">· {p.tipo}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{p.descricao ?? "Sem descrição"}</p>
            </div>
            <span className="font-display font-semibold num">{p.preco_centavos > 0 ? formatarDinheiro(p.preco_centavos) : "A combinar"}</span>
            <button type="button" onClick={() => setEditando(p.id)} className="h-9 cursor-pointer rounded-lg border border-fio px-3 text-sm hover:bg-white/5">
              Editar
            </button>
            <button type="button" disabled={pendente} onClick={() => iniciar(async () => { avisar(await arquivarProduto(p.id, !p.ativo)); router.refresh(); })} className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-fio text-muted-foreground hover:text-foreground" aria-label={p.ativo ? "Arquivar" : "Reativar"} title={p.ativo ? "Arquivar" : "Reativar"}>
              <Archive className="size-4" />
            </button>
          </div>
        ),
      )}
      {editando === "novo" ? (
        formulario()
      ) : (
        <button type="button" onClick={() => setEditando("novo")} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-fio px-4 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="size-4" /> Novo produto
        </button>
      )}
    </div>
  );
}

export function TesteEmail() {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        try {
          const r = await fetch("/api/email/teste", { method: "POST" });
          const d = (await r.json()) as { erro?: string; para?: string; provedor?: string };
          if (!r.ok) toast.error(d.erro ?? "O teste falhou.");
          else toast.success(`Teste enviado para ${d.para} pelo ${d.provedor}. Confira a caixa de entrada.`);
        } finally {
          setOcupado(false);
        }
      }}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-fio px-4 text-sm hover:bg-white/5"
    >
      {ocupado ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar e-mail de teste para mim
    </button>
  );
}

export function Copiavel({ texto }: { texto: string }) {
  return (
    <span className="flex items-center gap-2 rounded-lg border border-fio bg-white/[0.03] px-3 py-2 font-mono text-xs">
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      <button type="button" onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.success("Copiado."))} className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" aria-label="Copiar">
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}

export function Supressao({ itens }: { itens: Array<{ tipo: string; valor: string; motivo: string | null; origem: string | null; criado_em: string }> }) {
  const [tipo, setTipo] = useState("email");
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Quem pede para não receber mensagens (pelo link do e-mail, por resposta ou manualmente) entra aqui na hora: a empresa fica marcada como <b className="text-foreground">NÃO CONTATAR</b>, envios pendentes são cancelados e, se ela aparecer de novo em outra busca, já nasce bloqueada.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await adicionarSupressao(tipo, valor, "BR");
            avisar(r);
            if (r.ok) setValor("");
            router.refresh();
          });
        }}
      >
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={cn(campo, "w-36 cursor-pointer")}>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="dominio">Domínio</option>
        </select>
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "email" ? "contato@empresa.com" : tipo === "telefone" ? "+55 92 99999-0000" : "empresa.com.br"} className={cn(campo, "min-w-56 flex-1")} />
        <button type="submit" disabled={pendente || !valor.trim()} className={botaoPrimario}>
          Adicionar
        </button>
      </form>
      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-fio px-4 py-8 text-center text-sm text-muted-foreground">Lista vazia.</p>
      ) : (
        <ul className="divide-y divide-fio rounded-xl border border-fio">
          {itens.map((i) => (
            <li key={`${i.tipo}:${i.valor}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-20 text-xs text-muted-foreground">{i.tipo}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{i.valor}</span>
              <span className="text-xs text-muted-foreground">{i.origem ?? "—"} · {i.criado_em.slice(0, 10).split("-").reverse().join("/")}</span>
              <button type="button" disabled={pendente} onClick={() => window.confirm("Tirar da lista de supressão?") && iniciar(async () => { avisar(await tirarDaSupressao(i.tipo, i.valor)); router.refresh(); })} className="text-xs text-muted-foreground hover:text-perigo">
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
