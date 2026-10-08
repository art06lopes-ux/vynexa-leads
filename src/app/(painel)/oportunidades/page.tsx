import { redirect } from "next/navigation";

/** Virou a aba "Para abordar" de Leads (reorganização do menu, 08/10/2026). */
export default function Pagina() {
  redirect("/leads?aba=abordar");
}
