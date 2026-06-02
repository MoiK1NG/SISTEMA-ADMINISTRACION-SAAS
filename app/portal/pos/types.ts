export type Categoria = "todos" | "panes" | "postres" | "bebidas" | "salados"

export interface Producto {
  id:        string
  nombre:    string
  precio:    number
  categoria: Categoria
  emoji:     string       // placeholder visual sin depender de imágenes
  disponible: boolean
}

export interface ItemCarrito {
  producto:  Producto
  cantidad:  number
}
