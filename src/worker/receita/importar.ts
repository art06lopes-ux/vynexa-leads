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
import { createWriteStream } from "node:fs";
import { access, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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
const LOTE = 400;
const REGEX_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

type Linha = {
  cnpj: string;
  basico: string;
  nome: string;
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

  const { referencia, pastaRemota, origem } = await escolherPasta(process.env.RECEITA_REFERENCIA?.trim() || null);
  console.log(`Referência ${referencia} · origem: ${origem} · estados: ${ufs.join(", ")}`);

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
    const semFantasia: Array<{ cnpj: string; basico: string }> = [];
    const basicosPendentes = new Set<string>();
    const contagem = new Map<string, number>(ufs.map((u) => [u, 0]));

    for (const nome of ARQUIVOS_ESTAB) {
      const caminho = await obterArquivo(pasta, pastaRemota, nome, usarLocal);
      if (!caminho) {
        console.log(`  ${nome}: ausente, pulado.`);
        continue;
      }

      let lidas = 0;
      let aceitas = 0;
      let malformadas = 0;
      let lote: Linha[] = [];

      const inicio = Date.now();
      for await (const linha of linhasDoZip(caminho)) {
        lidas += 1;
        const campos = separar(linha);
        if (campos.length !== 30) {
          malformadas += 1;
          continue;
        }
        if (campos[C.situacao] !== SITUACAO_ATIVA) continue;
        if (!CNAES.has(campos[C.cnae]!)) continue;
        const uf = campos[C.uf]!;
        if (!quer.has(uf)) continue;

        const registro = montar(campos, municipios);
        if (!registro) continue;

        if (registro.nome === "") {
          semFantasia.push({ cnpj: registro.cnpj, basico: registro.basico });
          basicosPendentes.add(registro.basico);
        }

        lote.push(registro);
        contagem.set(uf, (contagem.get(uf) ?? 0) + 1);
        aceitas += 1;

        if (lote.length >= LOTE) {
          await gravarLote(banco, lote, referencia);
          lote = [];
        }
      }
      if (lote.length > 0) await gravarLote(banco, lote, referencia);

      const seg = Math.round((Date.now() - inicio) / 1000);
      console.log(
        `  ${nome}: ${lidas.toLocaleString("pt-BR")} linhas, ${aceitas.toLocaleString("pt-BR")} aceitas` +
          (malformadas > 0 ? `, ${malformadas} malformadas` : "") +
          ` (${seg}s)`,
      );

      if (!usarLocal) await rm(caminho, { force: true });
    }

    // Razão social só para quem não tem nome fantasia. Ler os 10 arquivos
    // de Empresas só para isso parece caro, mas é o único jeito: o nome
    // de um MEI vive lá, e um estabelecimento sem nome não serve.
    if (basicosPendentes.size > 0) {
      console.log(`${semFantasia.length.toLocaleString("pt-BR")} sem nome fantasia; buscando razão social…`);
      const razoes = new Map<string, string>();

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
          const campos = separar(linha);
          const razao = limparRazaoSocial(campos[1] ?? "");
          if (razao) razoes.set(basico, razao);
        }
        if (!usarLocal) await rm(caminho, { force: true });
      }

      let atualizadas = 0;
      for (let i = 0; i < semFantasia.length; i += LOTE) {
        const fatia = semFantasia.slice(i, i + LOTE);
        const statements = fatia
          .map((p) => {
            const razao = razoes.get(p.basico);
            if (!razao) return null;
            return {
              sql: `UPDATE receita_estabelecimentos SET nome = ?, razao_social = ? WHERE cnpj = ? AND nome = ''`,
              args: [razao, razao, p.cnpj],
            };
          })
          .filter((s): s is { sql: string; args: string[] } => s !== null);
        if (statements.length > 0) {
          await banco.batch(statements, "write");
          atualizadas += statements.length;
        }
      }
      console.log(`  ${atualizadas.toLocaleString("pt-BR")} nomes preenchidos pela razão social.`);
    }

    // Sem nome de nenhuma das duas fontes não há o que prospectar.
    for (const uf of ufs) {
      await banco.execute({
        sql: `DELETE FROM receita_estabelecimentos WHERE uf = ? AND nome = ''`,
        args: [uf],
      });
      // O que não veio nesta referência saiu da base (baixado, mudou de
      // estado) e sai daqui também. O mesmo para CNAE que deixou de ser
      // prospectado — senão a lista de segmentos só cresceria o banco.
      await banco.execute({
        sql: `DELETE FROM receita_estabelecimentos WHERE uf = ? AND (referencia <> ? OR cnae NOT IN (${[...CNAES].map(() => "?").join(",")}))`,
        args: [uf, referencia, ...CNAES],
      });
      const { rows } = await banco.execute({
        sql: `SELECT COUNT(*) AS n FROM receita_estabelecimentos WHERE uf = ?`,
        args: [uf],
      });
      const n = Number(rows[0]?.n ?? 0);
      await banco.execute({
        sql: `UPDATE receita_importacoes SET status = 'concluida', linhas = ?, concluido_em = ? WHERE id = ?`,
        args: [n, agora(), importacoes.get(uf)!],
      });
      console.log(`${uf}: ${n.toLocaleString("pt-BR")} estabelecimentos ativos na base.`);
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
 * Escolhe a pasta (mês) e de onde baixar: a Receita se responder, o
 * espelho se não. Pedindo uma referência específica, procura nas duas.
 */
async function escolherPasta(
  pedida: string | null,
): Promise<{ referencia: string; pastaRemota: string; origem: string }> {
  const falhas: string[] = [];
  for (const origem of [OFICIAL, ESPELHO]) {
    try {
      const pastas = (await origem.listar()).sort((a, b) => a[0].localeCompare(b[0]));
      const escolhida = pedida ? pastas.find(([ref]) => ref === pedida) : pastas.at(-1);
      if (!escolhida) {
        falhas.push(`${origem.nome}: sem a pasta ${pedida ?? "mais recente"}`);
        continue;
      }
      return { referencia: escolhida[0], pastaRemota: escolhida[1], origem: origem.nome };
    } catch (erro) {
      const causa = erro instanceof Error && erro.cause instanceof Error ? ` (${erro.cause.message})` : "";
      falhas.push(`${origem.nome}: ${erro instanceof Error ? erro.message : String(erro)}${causa}`);
      console.log(`  ${falhas.at(-1)}`);
    }
  }
  throw new Error(`Nenhuma origem respondeu — ${falhas.join("; ")}`);
}

/** Baixa (ou localiza) um arquivo. Devolve null se não existir. */
async function obterArquivo(pasta: string, pastaRemota: string, nome: string, usarLocal: boolean): Promise<string | null> {
  const destino = join(pasta, nome);

  if (usarLocal) {
    try {
      await access(destino);
      return destino;
    } catch {
      return null;
    }
  }

  const url = `${pastaRemota}/${nome}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(60 * 60_000) });
  if (r.status === 404) return null;
  if (!r.ok || !r.body) throw new Error(`Receita: ${nome} devolveu ${r.status}.`);

  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
  return destino;
}

async function lerMunicipios(pasta: string, pastaRemota: string, usarLocal: boolean): Promise<Map<string, string>> {
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

  return {
    cnpj,
    basico: c[C.basico]!,
    nome: c[C.fantasia]!.trim(),
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
}

async function gravarLote(banco: Client, lote: Linha[], referencia: string): Promise<void> {
  const marcadores = lote.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
  const args = lote.flatMap((l) => [
    l.cnpj, l.nome, null, l.cnae, l.cnaesSec, l.uf, l.municipioCodigo, l.municipio,
    l.logradouro, l.numero, l.complemento, l.bairro, l.cep, l.tel1, l.tel2, l.email, l.inicio, referencia,
  ]);
  await banco.execute({
    sql: `INSERT OR REPLACE INTO receita_estabelecimentos (
            cnpj, nome, razao_social, cnae, cnaes_secundarios, uf, municipio_codigo, municipio,
            logradouro, numero, complemento, bairro, cep, telefone_1, telefone_2, email, inicio_atividade, referencia
          ) VALUES ${marcadores}`,
    args,
  });
}

main().catch((erro) => {
  console.error("\nImportação da Receita falhou:\n", erro);
  process.exit(1);
});
