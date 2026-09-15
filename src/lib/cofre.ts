/**
 * Cifra de valores sensíveis guardados no banco (AES-256-GCM).
 *
 * Existe para o refresh token do Google: ele permite enviar e-mail em
 * nome do operador, indefinidamente. Guardá-lo em texto puro no Turso
 * significaria que qualquer vazamento do banco vira acesso ao Gmail.
 *
 * A chave é derivada de SEGREDO_SESSAO com SHA-256, então trocar o
 * segredo invalida também o que está cifrado — o operador precisaria
 * reconectar o Google. É o comportamento certo: trocar o segredo é o
 * gesto de "revogar tudo".
 *
 * WebCrypto, sem `node:crypto`: funciona na Vercel e no worker igual.
 */

async function chave(): Promise<CryptoKey> {
  const segredo = (process.env.SEGREDO_SESSAO ?? "").trim();
  if (segredo.length < 32) throw new Error("SEGREDO_SESSAO ausente ou curto demais para o cofre.");

  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function paraBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function deBase64(texto: string): Uint8Array {
  return new Uint8Array(Buffer.from(texto, "base64"));
}

/** Devolve `iv.cifrado`, ambos em base64. */
export async function cifrar(texto: string): Promise<string> {
  // IV novo a cada cifra: reutilizar IV em GCM quebra a segurança do modo.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await chave(),
    new TextEncoder().encode(texto),
  );
  return `${paraBase64(iv)}.${paraBase64(new Uint8Array(cifrado))}`;
}

export async function decifrar(guardado: string): Promise<string> {
  const [ivB64, dadosB64] = guardado.split(".");
  if (!ivB64 || !dadosB64) throw new Error("Valor cifrado em formato inválido.");

  const claro = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(ivB64) as BufferSource },
    await chave(),
    deBase64(dadosB64) as BufferSource,
  );
  return new TextDecoder().decode(claro);
}
