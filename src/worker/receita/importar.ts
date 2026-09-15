/**
 * Importador da base de CNPJs da Receita Federal.
 *
 * Roda no GitHub Actions uma vez por mês (ou na mão). Baixa os arquivos
 * de dados abertos da Receita, filtra os estabelecimentos ATIVOS dos
 * estados escolhidos em Ajustes e grava o recorte em
 * `receita_estabelecimentos`. É desse recorte que a caçada tira telefone
 * e e-mail oficiais.
 *
 * Fonte: https://arquivos.receitafederal.gov.br (dados abertos, sem
 * login, sem custo). Layout dos arquivos conferido contra o arquivo real
 * de 2026-09 — os índices de coluna abaixo vêm dele, não de memória.
 *
 * O servidor da Receita (SERPRO) não responde a partir dos runners do
 * GitHub — "fetch failed" em dois segundos, toda vez, enquanto daqui do
 * Brasil responde em meio segundo. Quando isso acontece o importador
 * cai para o espelho público da Casa dos Dados, que é uma cópia
 * byte a byte dos mesmos zips numa CDN. A origem usada fica registrada
 * em Ajustes; o conteúdo é o mesmo, a diferença é quem serviu.
 *
 * Tamanho: ~5,3 GB de zip só de estabelecimentos, ~17 GB de CSV
 * descompactado. Nada disso é guardado: cada zip é baixado, lido em
 * fluxo com `unzip -p` e apagado antes do próximo. Na memória fica só o
 * recorte do estado.
 *
 *   npm run receita            (referência mais recente, UFs dos Ajustes)
 *   RECEITA_UFS=AM,PA npm run receita
 */
import { spawn } from "node:child_process";
import { access, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import type { Client } from "@libsql/client";

import { agora, getBanco, novoId } from "@/db/cliente";
import { CNAES_POR_SEGMENTO } from "@/lib/receita/cnaes";
import { chaveDeMunicipio, limparRazaoSocial } from "@/lib/receita/texto";

type Origem = {
  nome: string;
  /** Pastas disponíveis: [referência AAAA-MM, URL base da pasta]. */
  listar(): Promise<Array<[string, string]>>;
};

const OFICIAL: Origem = {
  nome: "Receita Federal (arquivos.receitafederal.gov.br)",
  async listar() {
    const base = "https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9";
    // O servidor é um Nextcloud; a listagem sai por WebDAV (PROPFIND).
    const r = await fetch(`${base}/`, {
      method: "PROPFIND",
      headers: { Depth: "1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`listagem devolveu ${r.status}`);
    const xml = await r.text();
    return [...xml.matchAll(/\/(\d{4}-\d{2})\/</g)].map((m) => [m[1]!, `${base}/${m[1]}`]);
  },
};

const ESPELHO: Origem = {
  nome: "espelho Casa dos Dados (dados-abertos-rf-cnpj.casadosdados.com.br)",
  async listar() {
    const base = "https://dados-abertos-rf-cnpj.casadosdados.com.br/arquivos";
    const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`listagem devolveu ${r.status}`);
    const html = await r.text();
    // As pastas do espelho têm o dia da cópia: 2026-08-09. A referência
    // é o mês, como na Receita.
    return [...html.matchAll(/href="(\d{4}-\d{2})-\d{2}\/"/g)].map((m) => [m[1]!, `${base}/${m[0].slice(6, -2)}`]);
  },
};
const ARQUIVOS_ESTAB = Array.from({ length: 10 }, (_, i) => `Estabelecimentos${i}.zip`);
const ARQUIVOS_EMPRESAS = Array.from({ length: 10 }, (_, i) => `Empresas${i}.zip`);

/** Colunas do arquivo de estabelecimentos (30 campos). */
const C = {
  basico: 0,
  ordem: 1,
  dv: 2,
  fantasia: 4,
  situacao: 5,
  inicio: 10,
  cnae: 11,
  cnaesSec: 12,
  tipoLogradouro: 13,
  logradouro: 14,
  numero: 15,
  complemento: 16,
  bairro: 17,
  cep: 18,
  uf: 19,
  municipio: 20,
  ddd1: 21,
  tel1: 22,
  ddd2: 23,
  tel2: 24,
  email: 27,
} as const;

const SITUACAO_ATIVA = "02";

/**
 * Só os CNAEs que a ferramenta sabe prospectar. É o que faz o Brasil
 * inteiro caber no plano gratuito do Turso: dos ~22 milhões de
 * estabelecimentos ativos, os segmentos mapeados são uma fração.
 */
const CNAES = new Set(Object.values(CNAES_POR_SEGMENTO).flat());

const TODAS_UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE",
  "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];
/**
 * Linhas por INSERT e INSERTs em voo ao mesmo tempo.
 *
 * O gargalo da importação não é ler o CSV, é a ida ao Turso: do runner
 * do GitHub cada requisição leva ~100 ms de rede, e 900 mil linhas em
 * lotes de 400, um de cada vez, foram 1h30 só de espera. Lotes de 1000
 * (19 mil variáveis, abaixo do teto de 32 mil do SQLite) e quatro em
 * voo dividem isso por dez.
 */
const LOTE = 1_000;
const EM_VOO = 4;
const REGEX_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

type Linha = {
  cnpj: string;
  basico: string;
  nome: string;
  razaoSocial: string | null;
  hash: string;
  cnae: string;
  cnaesSec: string | null;
  uf: string;
  municipioCodigo: string;
  municipio: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  tel1: string | null;
  tel2: string | null;
  email: string | null;
  inicio: string | null;
};

async function main() {
  const banco = getBanco();
  const pasta = process.env.RECEITA_PASTA_LOCAL?.trim() || join(tmpdir(), "vynexa-receita");
  const usarLocal = Boolean(process.env.RECEITA_PASTA_LOCAL?.trim());
  await mkdir(pasta, { recursive: true });

  const ufs = await resolverUfs(banco);

  const { referencia, pastas: pastasRemotas, origem } = await escolherPasta(process.env.RECEITA_REFERENCIA?.trim() || null);
  console.log(`Referência ${referencia} · origem: ${origem} · estados: ${ufs.join(", ")}`);
  const pastaRemota = pastasRemotas;

  // Registrado já no início: se a rodada morrer no meio, Ajustes ainda
  // diz de onde ela estava tentando baixar.
  await banco.execute({
    sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('receita_origem_arquivos', ?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    args: [origem, agora()],
  });

  // Rodada anterior derrubada no meio (o Actions corta em 3 h) deixaria
  // 27 linhas "importando" para sempre. Mais de 4 h é morta, não lenta.
  await banco.execute({
    sql: `UPDATE receita_importacoes
          SET status = 'erro', erro = 'interrompida sem terminar (limite de tempo do GitHub Actions)', concluido_em = ?
          WHERE status = 'em_andamento' AND iniciado_em < datetime('now', '-4 hours')`,
    args: [agora()],
  });

  const importacoes = new Map<string, string>();
  for (const uf of ufs) {
    const id = novoId();
    importacoes.set(uf, id);
    await banco.execute({
      sql: `INSERT INTO receita_importacoes (id, referencia, uf) VALUES (?, ?, ?)`,
      args: [id, referencia, uf],
    });
  }

  try {
    const municipios = await lerMunicipios(pasta, pastaRemota, usarLocal);
    console.log(`${municipios.size} municípios.`);

    const quer = new Set(ufs);

    // ---- Passagem 1: quem não tem nome fantasia? ------------------------
    // Só o CNPJ básico de cada um, para a passagem 2 saber o que procurar
    // nos arquivos de Empresas. Nada é gravado ainda.
    const basicosPendentes = new Set<string>();
    let aceitasTotal = 0;
    for (const nome of ARQUIVOS_ESTAB) {
      const caminho = await obterArquivo(pasta, pastaRemota, nome, usarLocal);
      if (!caminho) continue;
      const inicio = Date.now();
      let aceitas = 0;
      for await (const linha of linhasDoZip(caminho)) {
        const campos = separar(linha);
        if (campos.length !== 30 || campos[C.situacao] !== SITUACAO_ATIVA) continue;
        if (!CNAES.has(campos[C.cnae]!) || !quer.has(campos[C.uf]!)) continue;
        aceitas += 1;
        if (campos[C.fantasia]!.trim() === "") basicosPendentes.add(campos[C.basico]!);
      }
      aceitasTotal += aceitas;
      console.log(`  ${nome}: ${aceitas.toLocaleString("pt-BR")} no recorte (${Math.round((Date.now() - inicio) / 1000)}s)`);
    }
    console.log(
      `${aceitasTotal.toLocaleString("pt-BR")} estabelecimentos no recorte; ${basicosPendentes.size.toLocaleString("pt-BR")} sem nome fantasia.`,
    );

    // ---- Passagem 2: razão social de quem precisa -----------------------
    // Ler os 10 arquivos de Empresas só para isso parece caro, mas é o
    // único jeito: o nome de um MEI vive lá, e sem nome não há o que
    // prospectar. Ler é barato; o que custa é escrever, e isto evita uma
    // segunda escrita em 80% das linhas.
    const razoes = new Map<string, string>();
    if (basicosPendentes.size > 0) {
      for (const nome of ARQUIVOS_EMPRESAS) {
        const caminho = await obterArquivo(pasta, pastaRemota, nome, usarLocal);
        if (!caminho) {
          console.log(`  ${nome}: ausente, pulado.`);
          continue;
        }
        for await (const linha of linhasDoZip(caminho)) {
          const fim = linha.indexOf('";"');
          if (fim < 2) continue;
          const basico = linha.slice(1, fim);
          if (!basicosPendentes.has(basico)) continue;
          const razao = limparRazaoSocial(separar(linha)[1] ?? "");
          if (razao) razoes.set(basico, razao);
        }
        if (!usarLocal) await rm(caminho, { force: true });
      }
      console.log(`  ${razoes.size.toLocaleString("pt-BR")} razões sociais encontradas.`);
    }

    // ---- O que já está na base -----------------------------------------
    // Um hash por linha: quem não mudou desde a última importação não é
    // reescrito. É o que faz a atualização mensal caber na cota de
    // escrita do plano gratuito — na primeira vez tudo entra; depois só
    // o que abriu, fechou ou trocou de telefone.
    const existentes = await hashesExistentes(banco, ufs);
    console.log(`${existentes.size.toLocaleString("pt-BR")} já na base.`);

    // ---- Passagem 3: gravar --------------------------------------------
    const contagem = new Map<string, { novas: number; alteradas: number; iguais: number }>(
      ufs.map((u) => [u, { novas: 0, alteradas: 0, iguais: 0 }]),
    );
    let semNome = 0;

    for (const nome of ARQUIVOS_ESTAB) {
      const caminho = await obterArquivo(pasta, pastaRemota, nome, usarLocal);
      if (!caminho) continue;
      const inicio = Date.now();
      let lote: Linha[] = [];
      let emVoo: Promise<void>[] = [];
      let gravadas = 0;

      for await (const linha of linhasDoZip(caminho)) {
        const campos = separar(linha);
        if (campos.length !== 30 || campos[C.situacao] !== SITUACAO_ATIVA) continue;
        if (!CNAES.has(campos[C.cnae]!) || !quer.has(campos[C.uf]!)) continue;

        const registro = montar(campos, municipios);
        if (!registro) continue;
        if (registro.nome === "") {
          const razao = razoes.get(registro.basico);
          if (!razao) {
            semNome += 1;
            continue;
          }
          registro.nome = razao;
          registro.razaoSocial = razao;
        }

        const c = contagem.get(registro.uf)!;
        const anterior = existentes.get(registro.cnpj);
        existentes.delete(registro.cnpj); // o que sobrar no mapa saiu da base
        if (anterior === registro.hash) {
          c.iguais += 1;
          continue;
        }
        if (anterior === undefined) c.novas += 1;
        else c.alteradas += 1;

        lote.push(registro);
        gravadas += 1;
        if (lote.length >= LOTE) {
          emVoo.push(gravarLote(banco, lote, referencia));
          lote = [];
          if (emVoo.length >= EM_VOO) {
            await Promise.all(emVoo);
            emVoo = [];
          }
        }
      }
      if (lote.length > 0) emVoo.push(gravarLote(banco, lote, referencia));
      await Promise.all(emVoo);

      console.log(`  ${nome}: ${gravadas.toLocaleString("pt-BR")} gravadas (${Math.round((Date.now() - inicio) / 1000)}s)`);
      if (!usarLocal) await rm(caminho, { force: true });
    }
    if (semNome > 0) console.log(`${semNome.toLocaleString("pt-BR")} sem nome em nenhuma das fontes, descartadas.`);

    // ---- Quem saiu -------------------------------------------------------
    // O que ficou no mapa não apareceu nesta referência: baixou, mudou
    // de estado ou de CNAE. Sai daqui também.
    const sairam = [...existentes.keys()];
    for (let i = 0; i < sairam.length; i += LOTE) {
      const fatia = sairam.slice(i, i + LOTE);
      await banco.execute({
        sql: `DELETE FROM receita_estabelecimentos WHERE cnpj IN (${fatia.map(() => "?").join(",")})`,
        args: fatia,
      });
    }
    if (sairam.length > 0) console.log(`${sairam.length.toLocaleString("pt-BR")} saíram da base.`);

    for (const uf of ufs) {
      const { rows } = await banco.execute({
        sql: `SELECT COUNT(*) AS n FROM receita_estabelecimentos WHERE uf = ?`,
        args: [uf],
      });
      const n = Number(rows[0]?.n ?? 0);
      const c = contagem.get(uf)!;
      await banco.execute({
        sql: `UPDATE receita_importacoes SET status = 'concluida', linhas = ?, concluido_em = ? WHERE id = ?`,
        args: [n, agora(), importacoes.get(uf)!],
      });
      console.log(
        `${uf}: ${n.toLocaleString("pt-BR")} na base · ${c.novas.toLocaleString("pt-BR")} novas, ${c.alteradas.toLocaleString("pt-BR")} alteradas, ${c.iguais.toLocaleString("pt-BR")} iguais`,
      );
    }

    for (const [chave, valor] of [
      ["receita_referencia", referencia],
      ["receita_origem_arquivos", origem],
    ]) {
      await banco.execute({
        sql: `INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
              ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
        args: [chave, valor, agora()],
      });
    }
  } catch (erro) {
    // `fetch failed` sozinho não diz nada; a causa (DNS, TLS, conexão
    // recusada) está em `cause`, e é ela que precisa ficar registrada.
    const causa = erro instanceof Error && erro.cause instanceof Error ? ` (${erro.cause.message})` : "";
    const mensagem = (erro instanceof Error ? erro.message : String(erro)) + causa;
    for (const id of importacoes.values()) {
      await banco.execute({
        sql: `UPDATE receita_importacoes SET status = 'erro', erro = ?, concluido_em = ? WHERE id = ? AND status = 'em_andamento'`,
        args: [mensagem, agora(), id],
      });
    }
    throw erro;
  }
}

/** Lista vazia em Ajustes significa o Brasil inteiro. */
async function resolverUfs(banco: Client): Promise<string[]> {
  const bruto =
    process.env.RECEITA_UFS?.trim() ||
    String((await banco.execute(`SELECT valor FROM configuracoes WHERE chave = 'receita_ufs'`)).rows[0]?.valor ?? "");
  const lista = [...new Set(bruto.toUpperCase().split(/[,\s;]+/).filter((u) => /^[A-Z]{2}$/.test(u)))];
  return lista.length === 0 || lista.includes("BR") ? TODAS_UFS : lista;
}

/**
 * Escolhe a pasta (mês) e de onde baixar.
 *
 * Lista as duas origens e devolve, para a referência escolhida, TODAS as
 * URLs de pasta que a têm — Receita primeiro, espelho depois. Cada
 * arquivo tenta na ordem: se a Receita derruba a conexão no meio de um
 * zip de 2 GB (aconteceu: "read ECONNRESET" aos 10 minutos), o mesmo
 * arquivo vem do espelho, byte a byte igual.
 */
async function escolherPasta(
  pedida: string | null,
): Promise<{ referencia: string; pastas: string[]; origem: string }> {
  const falhas: string[] = [];
  const disponiveis: Array<{ ref: string; url: string; origem: string }> = [];

  for (const origem of [OFICIAL, ESPELHO]) {
    try {
      for (const [ref, url] of await origem.listar()) disponiveis.push({ ref, url, origem: origem.nome });
    } catch (erro) {
      const causa = erro instanceof Error && erro.cause instanceof Error ? ` (${erro.cause.message})` : "";
      falhas.push(`${origem.nome}: ${erro instanceof Error ? erro.message : String(erro)}${causa}`);
      console.log(`  ${falhas.at(-1)}`);
    }
  }
  if (disponiveis.length === 0) throw new Error(`Nenhuma origem respondeu — ${falhas.join("; ")}`);

  const referencia = pedida ?? disponiveis.map((d) => d.ref).sort().at(-1)!;
  const pastas = disponiveis.filter((d) => d.ref === referencia);
  if (pastas.length === 0) throw new Error(`Nenhuma origem tem a pasta ${referencia}.`);

  return {
    referencia,
    pastas: pastas.map((p) => p.url),
    origem: pastas.map((p) => p.origem.split(" (")[0]).join(" + "),
  };
}

/**
 * Baixa (ou localiza) um arquivo. Devolve null se não existir em origem
 * nenhuma.
 *
 * O download é do curl, não do fetch: ele retoma de onde parou (`-C -`)
 * e tenta de novo sozinho quando a conexão cai — e com 2 GB por arquivo
 * vindos de um servidor que derruba conexão longa, cair é o normal, não
 * a exceção. Esgotadas as tentativas numa origem, passa para a próxima.
 */
async function obterArquivo(pasta: string, pastasRemotas: string[], nome: string, usarLocal: boolean): Promise<string | null> {
  const destino = join(pasta, nome);

  if (usarLocal) {
    try {
      await access(destino);
      return destino;
    } catch {
      return null;
    }
  }

  let ausenteEmTodas = true;
  for (const pastaRemota of pastasRemotas) {
    const url = `${pastaRemota}/${nome}`;
    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      const codigo = await curl(url, destino);
      if (codigo === 0) {
        const { size } = await stat(destino);
        console.log(`  ↓ ${nome} (${(size / 1_048_576).toFixed(0)} MB) de ${new URL(url).host}`);
        return destino;
      }
      // 22 = erro HTTP (com -f). 404 numa origem não é 404 nas outras.
      if (codigo === 22) break;
      ausenteEmTodas = false;
      console.log(`  ${nome}: tentativa ${tentativa} falhou (curl ${codigo}); retomando…`);
    }
  }

  if (ausenteEmTodas) return null;
  throw new Error(`${nome}: download falhou em todas as origens.`);
}

/** Exit code do curl. `-C -` retoma; `--retry` cobre quedas curtas. */
function curl(url: string, destino: string): Promise<number> {
  return new Promise((resolve) => {
    const filho = spawn(
      "curl",
      ["-fsSL", "--retry", "5", "--retry-delay", "10", "--retry-all-errors", "-C", "-", "--speed-limit", "10000", "--speed-time", "60", "-o", destino, url],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    filho.on("close", (codigo) => resolve(codigo ?? 1));
    filho.on("error", () => resolve(1));
  });
}

async function lerMunicipios(pasta: string, pastaRemota: string[], usarLocal: boolean): Promise<Map<string, string>> {
  const caminho = await obterArquivo(pasta, pastaRemota, "Municipios.zip", usarLocal);
  if (!caminho) throw new Error("Receita: Municipios.zip não encontrado.");
  const mapa = new Map<string, string>();
  for await (const linha of linhasDoZip(caminho)) {
    const campos = separar(linha);
    if (campos.length >= 2) mapa.set(campos[0]!, chaveDeMunicipio(campos[1]!));
  }
  return mapa;
}

/**
 * Linhas do único CSV dentro do zip, em fluxo.
 *
 * `unzip -p` escreve o conteúdo descompactado na saída padrão sem tocar
 * o disco — é o que permite ler um CSV de 7 GB num runner com 14 GB
 * livres e o zip ainda ocupando 2. O arquivo é latin-1, como toda base
 * legada do governo.
 */
async function* linhasDoZip(caminho: string): AsyncGenerator<string> {
  const filho = spawn("unzip", ["-p", caminho], { stdio: ["ignore", "pipe", "inherit"] });
  // O listener entra antes da leitura: se entrasse depois, o processo
  // poderia já ter fechado e a promessa nunca resolveria.
  const saida = new Promise<number>((resolve) => filho.on("close", (codigo) => resolve(codigo ?? 1)));
  filho.stdout.setEncoding("latin1");
  const rl = createInterface({ input: filho.stdout, crlfDelay: Infinity });
  for await (const linha of rl) yield linha;

  const codigo = await saida;
  if (codigo !== 0) throw new Error(`unzip saiu com código ${codigo} em ${caminho}`);
}

/** `"a";"b";"c"` → ["a","b","c"]. Os arquivos da Receita não escapam aspas. */
function separar(linha: string): string[] {
  if (linha.length < 2 || linha.charCodeAt(0) !== 34) return [];
  const fim = linha.endsWith('"') ? linha.length - 1 : linha.length;
  return linha.slice(1, fim).split('";"');
}

function telefone(ddd: string, numero: string): string | null {
  const d = ddd.replace(/\D/g, "");
  const n = numero.replace(/\D/g, "");
  if (d.length !== 2 || n.length < 8 || /^0+$/.test(n)) return null;
  return d + n;
}

function data(bruta: string): string | null {
  return /^\d{8}$/.test(bruta) ? `${bruta.slice(0, 4)}-${bruta.slice(4, 6)}-${bruta.slice(6, 8)}` : null;
}

function ouNulo(texto: string | undefined): string | null {
  const t = texto?.trim();
  return t ? t : null;
}

function montar(c: string[], municipios: Map<string, string>): Linha | null {
  const cnpj = `${c[C.basico]}${c[C.ordem]}${c[C.dv]}`;
  if (!/^\d{14}$/.test(cnpj)) return null;
  const cnae = c[C.cnae]!.trim();
  if (!/^\d{7}$/.test(cnae)) return null;
  const municipio = municipios.get(c[C.municipio]!);
  if (!municipio) return null;

  const emailBruto = c[C.email]!.trim().toLowerCase();
  const tipo = ouNulo(c[C.tipoLogradouro]);
  const logradouro = ouNulo(c[C.logradouro]);

  const registro: Linha = {
    cnpj,
    basico: c[C.basico]!,
    nome: c[C.fantasia]!.trim(),
    razaoSocial: null,
    hash: "",
    cnae,
    cnaesSec: ouNulo(c[C.cnaesSec]),
    uf: c[C.uf]!,
    municipioCodigo: c[C.municipio]!,
    municipio,
    logradouro: logradouro ? (tipo ? `${tipo} ${logradouro}` : logradouro) : null,
    numero: ouNulo(c[C.numero]),
    complemento: ouNulo(c[C.complemento]),
    bairro: ouNulo(c[C.bairro]),
    cep: ouNulo(c[C.cep]),
    tel1: telefone(c[C.ddd1]!, c[C.tel1]!),
    tel2: telefone(c[C.ddd2]!, c[C.tel2]!),
    email: REGEX_EMAIL.test(emailBruto) ? emailBruto : null,
    inicio: data(c[C.inicio]!),
  };
  // O nome entra no hash só quando vem do próprio arquivo (fantasia);
  // a razão social é preenchida depois e não muda o que interessa.
  registro.hash = fnv1a(
    [registro.nome, registro.cnae, registro.municipioCodigo, registro.logradouro, registro.numero,
     registro.complemento, registro.bairro, registro.cep, registro.tel1, registro.tel2, registro.email, registro.inicio].join("\u001f"),
  );
  return registro;
}

/** FNV-1a de 32 bits em hex: barato e suficiente para "mudou ou não". */
function fnv1a(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** cnpj → hash de tudo que está na base para estes estados. */
async function hashesExistentes(banco: Client, ufs: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (const uf of ufs) {
    let ultimo = "";
    for (;;) {
      const { rows } = await banco.execute({
        sql: `SELECT cnpj, hash FROM receita_estabelecimentos WHERE uf = ? AND cnpj > ? ORDER BY cnpj LIMIT 20000`,
        args: [uf, ultimo],
      });
      for (const r of rows) mapa.set(String(r.cnpj), String(r.hash ?? ""));
      if (rows.length < 20000) break;
      ultimo = String(rows.at(-1)!.cnpj);
    }
  }
  return mapa;
}

async function gravarLote(banco: Client, lote: Linha[], referencia: string): Promise<void> {
  const marcadores = lote.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
  const args = lote.flatMap((l) => [
    l.cnpj, l.nome, l.razaoSocial, l.cnae, l.cnaesSec, l.uf, l.municipioCodigo, l.municipio,
    l.logradouro, l.numero, l.complemento, l.bairro, l.cep, l.tel1, l.tel2, l.email, l.inicio, referencia, l.hash,
  ]);
  await banco.execute({
    sql: `INSERT OR REPLACE INTO receita_estabelecimentos (
            cnpj, nome, razao_social, cnae, cnaes_secundarios, uf, municipio_codigo, municipio,
            logradouro, numero, complemento, bairro, cep, telefone_1, telefone_2, email, inicio_atividade, referencia, hash
          ) VALUES ${marcadores}`,
    args,
  });
}

main().catch((erro) => {
  console.error("\nImportação da Receita falhou:\n", erro);
  process.exit(1);
});
