import { getBanco } from "@/db/cliente";
getBanco().execute("SELECT status FROM buscas WHERE pais='PT' AND segmento='estetica'").then(r=>console.log(String(r.rows[0]!.status)));
