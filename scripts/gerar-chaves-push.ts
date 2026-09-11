/**
 * Gera o par de chaves VAPID, uma vez.
 *
 *   npm run push:chaves
 *
 * Cole a saída nas variáveis de ambiente. A pública vai também ao
 * navegador (é pública mesmo); a privada fica só no servidor. Trocar o
 * par depois invalida todas as assinaturas — cada aparelho precisaria
 * ativar de novo.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\nCole no .env.local e nas variáveis da Vercel:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("\nA chave privada é segredo. Nunca entra no repositório.\n");
