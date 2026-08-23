// IVA Colombia — debe coincidir con v_iva en supabase/pos_schema.sql
export const IVA = 0.19

export const CATEGORIAS_POS = ["panes", "postres", "bebidas", "salados", "otros"] as const
export type CategoriaPos = (typeof CATEGORIAS_POS)[number]
