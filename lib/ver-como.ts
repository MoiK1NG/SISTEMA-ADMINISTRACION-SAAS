/**
 * Cookie que guarda el cliente que un admin está inspeccionando en modo
 * "ver como cliente".
 *
 * Vive en un módulo sin dependencias para que también la pueda leer el
 * middleware, que no carga las APIs de servidor de lib/admin-context.
 */
export const COOKIE_VER_COMO = "ver_como_agente"
