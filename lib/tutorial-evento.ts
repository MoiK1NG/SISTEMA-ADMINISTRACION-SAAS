/**
 * Evento con el que el botón "Ver tutorial" de la barra del portal vuelve a
 * abrir el tutorial. Vive aparte para que la barra no cargue el tutorial.
 */
export const EVENTO_ABRIR_TUTORIAL = "loms:abrir-tutorial"

export function abrirTutorial() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_TUTORIAL))
}
