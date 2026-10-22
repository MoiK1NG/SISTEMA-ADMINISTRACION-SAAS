# Rappi, PedidosYa y Uber Eats tienen API de pedidos y catálogo, pero ninguna es de libre acceso; y antes de la integración, la farmacia necesita autorización del ISP para vender en línea

**LOMS 360 · Investigación 03 · Pedidos de delivery**
Consultado el 21-10-2026.

---

## Lo esencial

1. **Las tres plataformas exponen API de pedidos, catálogo o menú y disponibilidad, siempre con aprobación previa.** Rappi entrega credenciales a través de su contacto comercial. PedidosYa las da el Account Manager a "Shops Partners". Uber Eats exige NDA, contrato de licencia de API y aprobación escrita.
2. **La restricción que manda es la sanitaria, no la técnica.** El DS 466 (Título VI bis, vigente desde el 07-05-2020) exige autorización del ISP para vender medicamentos por medios electrónicos. Permite el despacho por terceros, pero **la responsabilidad sanitaria sigue siendo de la farmacia**, y **las recetas-cheque quedan excluidas**.
3. **Para una farmacia de un local, el valor de integrar hoy es bajo:** cada plataforma ya le da un portal o tablet para operar sin integración.

---

## 1. API por plataforma (dato con fuente)

| | **Rappi** | **PedidosYa** (Delivery Hero) | **Uber Eats** |
|---|---|---|---|
| Documentación | [Portal de desarrolladores Rappi](https://dev-portal.dev.rappi.com/) | [developer.pedidosya.com – Partner Picking FAQ](https://developer.pedidosya.com/en/documentation/pos-partner-picking-faq) · [Delivery Hero Q-Commerce Partner API](https://developers.deliveryhero.com/documentation/qc-API-integration.html) | [Uber Eats Marketplace APIs](https://developer.uber.com/docs/eats/introduction) |
| Pedidos | Sí: gestión de pedidos y consulta de cambios. | Sí: webhook con estados `RECEIVED`, `READY_FOR_PICKUP`, `DISPATCHED`, `CANCELLED`, más GET/PUT del pedido. | Sí: order processing. |
| Catálogo / menú | Sí: consulta y gestión de menús. | Sí, en una API de catálogo separada. Precios y disponibilidad también se manejan en Partner Portal. | Sí: menu synchronization. |
| Stock / disponibilidad | Sí: "item availability". | La disponibilidad por producto se gestiona en Partner Portal. La FAQ no muestra una API dedicada de stock. | Sí, como actualización parcial de ítems dentro de la API de menú. |
| Estado de tienda | Información de tiendas y webhooks de tienda. | Configuración por vendor ID. | Store management. |
| Cómo se accede | Contacto comercial de Rappi. Según catálogos de terceros, OAuth2 con aprobación manual y certificación previa a producción ([apis.io](https://apis.io/apis/rappi/partners-api/), no verificado en la fuente oficial). | Acceso a Partner Portal con el plugin de integración, client ID y secret entregados por el Account Manager, y webhook con secreto. Tokens de 2 h y límite de **60 solicitudes/min**. | Sandbox de autoservicio, luego **NDA y API licensing agreement** con el partner manager. "Access to These APIs May Require Written Approval From Uber" ([Getting Started](https://developer.uber.com/docs/eats/guides/getting-started)). |
| Vertical | La página no distingue restaurantes de retail. | Orientada a **"Shops Partners"** (retail), no a restaurantes. | Tiene una sección "For Retailers" en la guía de pedidos. |
| Países | El portal no lista países. | La FAQ no lista países; los ejemplos usan `AR`. | El Getting Started no indica restricciones de país. |
| Costo de la API / comisiones | **No publicado.** | **No publicado.** | **No publicado.** |
| Presencia en Chile con farmacias | Opera en 23 ciudades y tiene categoría "Farmacias" ([El Dínamo, 22-08-2025](https://www.eldinamo.cl/economia/negocios-economia/2025/08/22/rappi-celebra-una-decada-y-aterriza-cifras-en-chile-inversiones-por-us35-millones-6-500-repartidores-y-10-mil-restaurantes/)). | Farmacias Ahumada vende por PedidosYa desde 2021 ([Chócale, 2021](https://chocale.cl/2021/08/farmacias-ahumada-se-suma-a-pedidos-ya-con-despachos-express/)). | Muestra farmacias (Ahumada, Salcobrand) en ciudades chilenas ([ubereats.com/cl](https://www.ubereats.com/cl-en/category/temuco-ar/pharmacy)). |

**Intermediarios.** Deliverect y Ordatic, entre otros, ofrecen conectores a Rappi y PedidosYa. Deliverect avisa que su integración con PedidosYa es "solo para clientes existentes" y exige suscripción a ambas plataformas ([Deliverect](https://www.deliverect.com/en/integrations/pedidosya)). Sus precios no se revisaron.

## 2. Regulación chilena para vender medicamentos por delivery (dato con fuente)

Fuente principal: **DS 466/1984 MINSAL, Título VI bis**, agregado por el Decreto 58 de Salud (D.O. 07-05-2020). Usamos el texto refundido que publica el ISP, con última modificación del 10-06-2020 ([PDF ISP](https://www.ispch.cl/sites/default/files/normativa_anamed/establecimientos_autorizacion_y_fiscalizacion/Decreto%20Supremo%20466.pdf)).

| Tema | Qué exige | Artículo |
|---|---|---|
| Autorización | Para vender por medios electrónicos se requiere "autorización de comercialización ante el Instituto de Salud Pública". La autorización es indefinida. | 87° A |
| Requisitos | Tener autorización de funcionamiento, un sitio electrónico de soporte y un servicio de entrega, propio **o de un tercero**, que respete las condiciones de conservación. | 87° B |
| Venta directa (OTC) | Se puede despachar sin receta. | 87° E |
| Receta simple | Hay que comunicar antes la receta a la farmacia, ya sea electrónica o como copia digitalizada. La farmacia verifica que la copia corresponda al original. | 87° E |
| Receta retenida | Se acepta receta electrónica o copia digitalizada; **si es copia, la receta física se entrega al recibir el producto.** | 87° E |
| **Receta-cheque** | **"No están comprendidos entre aquellos que pueden expenderse por medios electrónicos"** (estupefacientes y psicotrópicos). | 87° E |
| Bioequivalentes | Antes de cerrar la compra, el sitio debe ofrecer las alternativas bioequivalentes. | 87° F |
| Datos del cliente | Nombre, apellido, teléfono, correo y dirección. | 87° G |
| Despacho | Paquete sellado y etiquetado. El transporte puede hacerlo un tercero, pero **"la responsabilidad sanitaria … será siempre del establecimiento"**. | 87° H |
| Ficha de producto | Foto del envase, nombre, principio activo (DCI), forma farmacéutica, dosis, precio y precio fraccionado. | 87° K |
| Datos sensibles | La receta es dato sensible (Ley 19.628). | 87° N |

Arancel del ISP por esta autorización: **no lo encontramos publicado.** El ISP tiene un instructivo de autorizaciones de farmacias, actualizado en 2025 según el buscador ([PDF ISP](https://www.ispch.gob.cl/wp-content/uploads/2025/10/Instructivo-autorizaciones-de-farmacias.pdf)), que no revisamos en detalle.

**Lectura nuestra.** El reglamento habla del "sitio electrónico" de la farmacia. No encontramos un pronunciamiento sobre si aparecer en el catálogo de Rappi, PedidosYa o Uber Eats cuenta como ese sitio o si la farmacia necesita uno propio. Hay que preguntarlo al ISP o a un abogado sanitario.

---

## Qué recomendamos (opinión nuestra, no dato)

1. **No integrar delivery en el MVP.** Con 1 local y ~665 productos, la farmacia puede operar desde el portal o la tablet de cada plataforma. La API exige aprobación comercial que una farmacia pequeña difícilmente justifica, y el costo y las comisiones no son públicos.
2. **Preparar el modelo de datos** para lo que pediría cualquier integración futura: SKU con principio activo (DCI), forma farmacéutica, dosis, condición de venta (directa / simple / retenida / cheque), foto del envase y stock disponible por producto. Esto sirve igual para una tienda web propia.
3. **Bloquear por diseño los productos con receta-cheque** en cualquier canal en línea, y marcar los de receta retenida, que exigen recibir la receta física en la entrega.
4. **Si un cliente lo pide, empezar por PedidosYa**, cuya API está orientada a retail ("Shops"), o por un intermediario como Deliverect, en vez de integrar las tres.

## Qué falta confirmar

- Si Farmacia Luis Gabriel tiene o quiere la autorización del ISP para expendio electrónico, y si hoy vende por alguna app.
- Las comisiones y costos de Rappi, PedidosYa y Uber Eats para farmacias en Chile (no publicados).
- Si las API de Rappi y PedidosYa están habilitadas para comercios chilenos de la categoría farmacia; los portales no listan países.
- Si figurar en un marketplace de delivery cumple el requisito de "sitio electrónico" del art. 87° B.
- Si el Título VI bis tuvo modificaciones posteriores a junio de 2020; el texto que usamos lo generó LeyChile el 12-11-2020.
