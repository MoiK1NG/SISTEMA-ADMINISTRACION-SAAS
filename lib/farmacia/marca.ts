/**
 * Marca de cada negocio: logo y un color de una paleta cerrada. Todos los
 * colores tienen contraste suficiente con texto blanco (pestaña activa de la
 * barra). La lista tiene que coincidir con negocios_color_check en
 * supabase/farmacia_marca_y_equipo.sql.
 */
export const COLOR_LOMS = "#185FA5"

export const PALETA_NEGOCIO = [
  { color: "#0F766E", nombre: "Verde azulado" },
  { color: "#15803D", nombre: "Verde"         },
  { color: "#B45309", nombre: "Ámbar"         },
  { color: "#B91C1C", nombre: "Rojo"          },
  { color: "#BE185D", nombre: "Fucsia"        },
  { color: "#7E22CE", nombre: "Morado"        },
  { color: "#1D4ED8", nombre: "Azul intenso"  },
  { color: "#334155", nombre: "Grafito"       },
] as const

export type ColorNegocio = (typeof PALETA_NEGOCIO)[number]["color"]

export const LOGO_MAX_BYTES = 500 * 1024
export const LOGO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const
export const BUCKET_LOGOS = "logos-negocios"
