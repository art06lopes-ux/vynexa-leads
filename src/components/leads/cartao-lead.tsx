"use client";

import { motion } from "framer-motion";
import { Check, ExternalLink, Globe, Mail, MapPin, MessageCircle, Star } from "lucide-react";
import Link from "next/link";

import type { LeadListado } from "@/db/leads";
import { cn } from "@/lib/utils";

import { SeloEtapa, SeloPresenca } from "./presenca";
import { AnelScore } from "./score";

/** Iniciais e uma cor estável por nome, para o avatar (sem foto inventada). */
export function Avatar({ nome, tamanho = 40 }: { nome: string; tamanho?: number }) {
  const iniciais = nome
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-white"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36, background: `linear-gradient(145deg, hsl(${h} 55% 42%), hsl(${(h + 40) % 360} 60% 28%))` }}
      aria-hidden="true"
    >
      {iniciais || "?"}
    </span>
  );
}

export function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function Canal({ ativo, rotulo, children, verde = false }: { ativo: boolean; rotulo: string; children: React.ReactNode; verde?: boolean }) {
  return (
    <span
      title={`${rotulo}: ${ativo ? "encontrado" : "não encontrado"}`}
      aria-label={`${rotulo}: ${ativo ? "encontrado" : "não encontrado"}`}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg border",
        ativo ? (verde ? "border-[#1fa855]/40 bg-[#1fa855]/15 text-[#3ddc84]" : "border-brilho/30 bg-azul/12 text-ciano") : "border-fio text-muted-foreground/35",
      )}
    >
      {children}
    </span>
  );
}

export function CartaoLead({
  lead,
  selecionado,
  aoSelecionar,
  mostrarEtapa = false,
}: {
  lead: LeadListado;
  selecionado: boolean;
  aoSelecionar: (id: string) => void;
  mostrarEtapa?: boolean;
}) {
  const nota = lead.avaliacao_nota !== null ? lead.avaliacao_nota.toFixed(1).replace(".", ",") : null;
  const local = [lead.bairro, lead.cidade, lead.estado].filter(Boolean).join(", ");

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("placa group flex flex-col gap-3 p-4 transition-colors", selecionado ? "border-brilho/60 bg-azul/[0.07]" : "hover:border-brilho/30")}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={selecionado}
          aria-label={`Selecionar ${lead.nome}`}
          onClick={() => aoSelecionar(lead.lead_id)}
          className={cn(
            "mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors",
            selecionado ? "border-brilho bg-azul text-white" : "border-white/25 hover:border-brilho",
          )}
        >
          {selecionado && <Check className="size-3.5" strokeWidth={3} />}
        </button>
        <Avatar nome={lead.nome} />
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.lead_id}`} className="line-clamp-1 font-semibold leading-snug hover:text-ciano">
            {lead.nome}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{lead.categoria_rotulo ?? lead.categoria}</p>
        </div>
        <AnelScore score={lead.score_oportunidade} tamanho={42} />
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {local && (
          <p className="flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" /> {local}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Star className={cn("size-3.5 shrink-0", nota ? "fill-aviso text-aviso" : "")} aria-hidden="true" />
          {nota ? (
            <>
              <span className="font-semibold text-foreground">{nota}</span> · {lead.avaliacao_qtd?.toLocaleString("pt-BR")} avaliações
            </>
          ) : (
            "Sem avaliações na fonte"
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SeloPresenca statusSite={lead.status_site} qualidade={lead.site_qualidade} />
        {mostrarEtapa && <SeloEtapa etapa={lead.etapa} />}
        {lead.nao_contatar === 1 && <span className="inline-flex h-6 items-center rounded-full border border-perigo/30 bg-perigo/10 px-2 text-[0.7rem] font-semibold text-perigo">Não contatar</span>}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-fio pt-3">
        <div className="flex gap-1">
          <Canal ativo={Boolean(lead.website) && lead.status_site === "tem_site"} rotulo="Site">
            <Globe className="size-3.5" />
          </Canal>
          <Canal ativo={lead.whatsapp === 1} rotulo="WhatsApp" verde>
            <MessageCircle className="size-3.5" />
          </Canal>
          <Canal ativo={Boolean(lead.email)} rotulo="E-mail">
            <Mail className="size-3.5" />
          </Canal>
          <Canal ativo={Boolean(lead.instagram)} rotulo="Instagram">
            <IconeInstagram className="size-3.5" />
          </Canal>
        </div>
        <div className="flex items-center gap-1">
          {lead.fonte_url && (
            <a href={lead.fonte_url} target="_blank" rel="noopener noreferrer" title="Abrir na fonte" aria-label="Abrir na fonte (Google Maps ou OpenStreetMap)" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <Link href={`/leads/${lead.lead_id}`} className="inline-flex h-8 items-center rounded-lg bg-azul/90 px-3 text-xs font-semibold text-white transition-colors hover:bg-brilho">
            Abrir lead
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export function EsqueletoCartao() {
  return (
    <div className="placa space-y-3 p-4" aria-hidden="true">
      <div className="flex gap-3">
        <span className="esqueleto size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <span className="esqueleto block h-3.5 w-3/4" />
          <span className="esqueleto block h-3 w-1/2" />
        </div>
        <span className="esqueleto size-10 rounded-full" />
      </div>
      <span className="esqueleto block h-3 w-2/3" />
      <span className="esqueleto block h-6 w-24 rounded-full" />
      <span className="esqueleto block h-8 w-full" />
    </div>
  );
}
