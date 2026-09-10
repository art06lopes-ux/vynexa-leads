/**
 * Fila serial com intervalo mínimo entre chamadas.
 *
 * O Nominatim exige no máximo 1 requisição por segundo somadas todas as
 * aplicações do mesmo operador, e bloqueia quem passa disso. A Overpass
 * é mais tolerante, mas responde 429 sob rajada. Como este projeto roda
 * numa instância só, um limitador em memória é suficiente e honesto —
 * ele não sobrevive a escala horizontal, e isso está anotado de propósito.
 *
 * Serial e não "N por segundo": as políticas do OSM pedem uma thread só.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export function criarLimitador(intervaloMs: number) {
  let fim: Promise<void> = Promise.resolve();

  return function agendar<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fim.then(tarefa);

    // A corrente segue mesmo quando a tarefa falha: um erro numa chamada
    // não pode travar a fila para sempre.
    fim = resultado.then(
      () => esperar(intervaloMs),
      () => esperar(intervaloMs),
    );

    return resultado;
  };
}

export function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
