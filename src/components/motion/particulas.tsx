"use client";

import { useEffect, useRef } from "react";

/**
 * Particle Animation (guia, cat. 05): pontos vermelhos flutuando com
 * linhas finas entre os próximos — o fundo "rede de dados" da referência.
 *
 * Canvas 2D próprio, sem biblioteca: são 60 pontos e um laço de
 * `requestAnimationFrame`. Para quando a aba perde o foco, para sob
 * "reduzir movimento", e limita a 30 quadros por segundo — é decoração,
 * e decoração não pode roubar bateria de um painel que fica aberto o
 * dia todo.
 */
export function Particulas({ densidade = 60, className }: { densidade?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Ponto = { x: number; y: number; vx: number; vy: number; r: number };
    let pontos: Ponto[] = [];
    let largura = 0;
    let altura = 0;
    let quadro = 0;
    let ultimo = 0;
    let ativo = true;

    function redimensionar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = canvas!.clientWidth;
      altura = canvas!.clientHeight;
      canvas!.width = largura * dpr;
      canvas!.height = altura * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Menos pontos em tela estreita: no celular a área é menor e a
      // mesma densidade viraria um borrão.
      const n = Math.round(densidade * Math.min(1, largura / 900));
      pontos = Array.from({ length: n }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.4,
      }));
    }

    function desenhar(t: number) {
      if (!ativo) return;
      quadro = requestAnimationFrame(desenhar);

      // 30 fps bastam para pontos lentos, e é metade do custo.
      if (t - ultimo < 33) return;
      ultimo = t;

      ctx!.clearRect(0, 0, largura, altura);

      for (const p of pontos) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > largura) p.vx *= -1;
        if (p.y < 0 || p.y > altura) p.vy *= -1;
      }

      // Linhas entre vizinhos próximos, mais fracas quanto mais longe.
      const LIMITE = 120;
      for (let i = 0; i < pontos.length; i += 1) {
        for (let j = i + 1; j < pontos.length; j += 1) {
          const a = pontos[i]!;
          const b = pontos[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > LIMITE) continue;
          ctx!.strokeStyle = `rgba(224, 165, 38, ${(1 - d / LIMITE) * 0.16})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      for (const p of pontos) {
        ctx!.fillStyle = "rgba(224, 165, 38, 0.65)";
        ctx!.shadowColor = "rgba(224, 165, 38, 0.6)";
        ctx!.shadowBlur = 6;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;
    }

    function aoMudarVisibilidade() {
      ativo = !document.hidden;
      if (ativo) quadro = requestAnimationFrame(desenhar);
      else cancelAnimationFrame(quadro);
    }

    redimensionar();
    quadro = requestAnimationFrame(desenhar);
    window.addEventListener("resize", redimensionar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      ativo = false;
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", redimensionar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [densidade]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
