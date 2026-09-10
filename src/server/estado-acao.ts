/**
 * Estado das Server Actions usadas com `useActionState`.
 *
 * Vive fora de `acoes-auth.ts` por exigência do Next: um arquivo com
 * "use server" só pode exportar funções assíncronas. Exportar a constante
 * de lá quebra o build com "found object".
 */
export type EstadoAcao = { mensagem: string | null };

export const ESTADO_INICIAL: EstadoAcao = { mensagem: null };
