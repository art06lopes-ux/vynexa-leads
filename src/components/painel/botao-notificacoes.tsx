"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Estado = "carregando" | "sem_suporte" | "negado" | "inativo" | "ativo";

/** Base64url → bytes, que é o formato que `subscribe` exige para a chave. */
function decodificarChave(base64url: string): Uint8Array {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bruto = atob(base64);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

/**
 * Liga e desliga as notificações neste aparelho.
 *
 * Explica o estado em texto, sempre: "sem suporte" no Safari de aba
 * comum, "negado" quando o usuário bloqueou, "ativo" quando funciona.
 * Um botão que só muda de ícone deixaria o operador sem saber por que
 * nada chegou.
 */
export function BotaoNotificacoes() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    // Tudo numa função assíncrona: o estado só é gravado em callback,
    // nunca no corpo do efeito — `setState` síncrono ali dispara
    // renderização em cascata, e a regra de lint reprova com razão.
    async function detectar(): Promise<Estado> {
      // Sem service worker ou sem Push API não há o que fazer — é o caso
      // do Safari em aba normal, e do iOS sem "Adicionar à tela inicial".
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "sem_suporte";
      if (Notification.permission === "denied") return "negado";

      const registro = await navigator.serviceWorker.register("/sw.js");
      const assinatura = await registro.pushManager.getSubscription();
      return assinatura ? "ativo" : "inativo";
    }

    detectar()
      .then((e) => {
        if (!cancelado) setEstado(e);
      })
      .catch(() => {
        if (!cancelado) setEstado("sem_suporte");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  async function ativar() {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado("negado");
        toast.error("Permissão negada. Libere nas configurações do navegador.");
        return;
      }

      const resposta = await fetch("/api/push");
      const dados = (await resposta.json()) as { chavePublica?: string; erro?: string };
      if (!resposta.ok || !dados.chavePublica) {
        toast.error(dados.erro ?? "Push não configurado no servidor.");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodificarChave(dados.chavePublica) as BufferSource,
      });

      const json = assinatura.toJSON();
      const gravar = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          agente: navigator.userAgent.slice(0, 300),
        }),
      });

      if (!gravar.ok) {
        toast.error("Não consegui registrar este aparelho.");
        return;
      }

      setEstado("ativo");
      toast.success("Notificações ativadas neste aparelho.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao ativar.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.getSubscription();
      if (assinatura) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: assinatura.endpoint }),
        });
        await assinatura.unsubscribe();
      }
      setEstado("inativo");
      toast.success("Notificações desativadas neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando") {
    return (
      <Button variant="secondary" disabled className="h-11 gap-2">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Verificando…
      </Button>
    );
  }

  if (estado === "sem_suporte") {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" disabled className="h-11 gap-2">
          <BellOff className="size-4" aria-hidden="true" />
          Sem suporte neste navegador
        </Button>
        <p className="text-xs text-muted-foreground">
          No iPhone: Safari → Compartilhar → <strong>Adicionar à Tela de Início</strong>, e abra
          pelo ícone. Só assim a Apple libera notificação.
        </p>
      </div>
    );
  }

  if (estado === "negado") {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" disabled className="h-11 gap-2">
          <BellOff className="size-4" aria-hidden="true" />
          Permissão bloqueada
        </Button>
        <p className="text-xs text-muted-foreground">
          Você negou a permissão. Libere nas configurações do site no navegador e recarregue.
        </p>
      </div>
    );
  }

  if (estado === "ativo") {
    return (
      <Button
        onClick={desativar}
        disabled={ocupado}
        variant="secondary"
        className="h-11 cursor-pointer gap-2"
      >
        <BellRing className="size-4 text-emerald-300" aria-hidden="true" />
        Ativas neste aparelho · desativar
      </Button>
    );
  }

  return (
    <Button onClick={ativar} disabled={ocupado} className="h-11 cursor-pointer gap-2">
      {ocupado ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Bell className="size-4" aria-hidden="true" />
      )}
      Ativar notificações neste aparelho
    </Button>
  );
}
