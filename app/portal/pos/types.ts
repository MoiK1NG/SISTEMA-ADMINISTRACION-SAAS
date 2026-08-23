import type { CategoriaPos } from "./constants"

export type Categoria = "todos" | CategoriaPos

export interface Producto {
  id:         string
  nombre:     string
  precio:     number
  categoria:  CategoriaPos
  emoji:      string       // placeholder visual sin depender de imágenes
  disponible: boolean
}

export interface ItemCarrito {
  producto:  Producto
  cantidad:  number
}
