"use client";

import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

/**
 * Registro único do GSAP e dos plugins usados.
 *
 * Importar daqui, e não de `gsap` direto: garante que o registro roda
 * uma vez, e que ninguém usa DrawSVG sem ele estar registrado — o erro
 * que isso dá é silencioso (a animação simplesmente não acontece).
 *
 * GSAP é gratuito desde abril de 2025, plugins incluídos, para uso
 * comercial. Nenhuma chave ou licença é necessária.
 */
gsap.registerPlugin(DrawSVGPlugin, ScrambleTextPlugin);

/**
 * Media query que respeita a preferência do sistema.
 *
 * Toda animação decorativa entra dentro de `mm.add(SEM_REDUCAO, …)`. Com
 * "reduzir movimento" ligado, o GSAP nem cria o tween, e o elemento já
 * nasce no estado final. Não é opcional: é o que separa um efeito bonito
 * de um site que dá enjoo em quem tem sensibilidade a movimento.
 */
export const SEM_REDUCAO = "(prefers-reduced-motion: no-preference)";

/** Curva padrão do projeto: sai rápido, assenta suave. */
export const SUAVE = "power3.out";

/** Elastic (guia, cat. 01): passa um pouco do ponto e volta. Para o dock. */
export const ELASTICO = "elastic.out(1, 0.6)";

export { gsap };
