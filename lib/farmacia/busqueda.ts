/**
 * Búsqueda de texto en el cliente para catálogos de hasta unos miles de filas
 * (POS e inventario). Sin dependencias ni "use client": también sirve en el
 * servidor.
 *
 * El índice se arma una vez por catálogo (texto ya normalizado) y cada
 * búsqueda recorre el arreglo con `for`/`break`: para 5.000 productos cuesta
 * 1-2 ms, muy por debajo de lo que tarda un lector de código de barras entre
 * tecla y tecla.
 */

/** Minúsculas, sin tildes ni diéresis, espacios colapsados: "Ácido" ≈ "acido". */
export function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export interface Indexado<T> {
  item:  T
  texto: string
}

export function indexar<T>(items: T[], textoDe: (item: T) => string): Indexado<T>[] {
  return items.map(item => ({ item, texto: normalizar(textoDe(item)) }))
}

/**
 * Hasta `limite` resultados. Primero los que EMPIEZAN con lo escrito (al
 * tipear "para" conviene ver "Paracetamol" antes que "Diclofenaco + paracetamol"),
 * después los que lo contienen.
 */
export function buscar<T>(indice: Indexado<T>[], consulta: string, limite: number): T[] {
  const q = normalizar(consulta)
  if (!q || limite <= 0) return []

  const salida: T[] = []
  for (const e of indice) {
    if (e.texto.startsWith(q)) {
      salida.push(e.item)
      if (salida.length >= limite) return salida
    }
  }
  for (const e of indice) {
    if (!e.texto.startsWith(q) && e.texto.includes(q)) {
      salida.push(e.item)
      if (salida.length >= limite) return salida
    }
  }
  return salida
}
