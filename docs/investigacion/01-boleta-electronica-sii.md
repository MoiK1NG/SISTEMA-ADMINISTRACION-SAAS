# En Chile toda venta en efectivo o transferencia exige boleta electrónica, y lo más rápido es emitirla vía API de un proveedor por 0,1–0,75 UF al mes

**LOMS 360 · Investigación 01 · Boleta electrónica SII**
Consultado el 21-10-2026. Valores de referencia: UF $41.194,55 (SII, 21-10-2026) y dólar observado $972,60 (SII, 01-10-2026, último publicado en la tabla del SII).

---

## Lo esencial

1. **Efectivo o transferencia → boleta electrónica, siempre.** Con tarjeta, el voucher puede hacer de boleta, según el modelo que use el comercio. Esa regla viene de 2021 y la reafirmó la Res. Ex. SII N°53 de 2025.
2. **Entregar un comprobante también es obligatorio, impreso o digital.** Rige desde el 01-05-2025 para quien tiene impresora y desde el 01-03-2026 para el resto (Res. 53/2025).
3. **Para emitir con software propio hace falta certificarse ante el SII.** Son un set de pruebas con 10 a 15 días hábiles de revisión y luego una declaración de cumplimiento. Un proveedor con API se salta ese trabajo: certifica al cliente y expone un endpoint para emitir.
4. **El papel térmico de 58 mm cumple el ancho mínimo general para boletas (5,7 cm), y el de 80 mm también.** El timbre PDF417 debe medir como mínimo 2 × 4,5 cm.

---

## 1. Qué exige la norma (dato con fuente)

### Boleta vs. voucher de tarjeta (2021 → 2025)

| Hito | Qué dice | Fuente |
|---|---|---|
| Ley 21.210 (2020) | Hace obligatoria la boleta electrónica y el envío al SII de copia de cada boleta. Los comprobantes de pagos electrónicos tienen "valor de boleta" en la forma que fije el SII. | [Instructivo técnico boleta electrónica SII, 28-10-2021](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) |
| Res. Ex. SII N°176/2020 (mod. por N°76/2021) | Procedimiento para que el comprobante de pago electrónico (voucher) valga como boleta. Si se paga con tarjeta, el voucher reemplaza a la boleta. Si se paga en efectivo, corresponde boleta. | Citada en el considerando 4° de la [Res. 53/2025](https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso53.pdf). Detalle en [Círculo Verde](https://www.circuloverde.cl/emision-de-boletas-de-ventas-electronicas-consideraciones-importantes/) (fuente secundaria). |
| Obligatoriedad | Desde el 01-01-2021 para quienes ya emitían factura electrónica y desde el 01-03-2021 para el resto. | [Instructivo técnico SII, 2021](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) |
| Res. Ex. SII N°53/2022 | Elimina el envío del Resumen de Ventas Diarias (ex RCOF) desde el 01-08-2022. | [Noticia SII, 04-08-2022](https://www.sii.cl/noticias/2022/040822noti01rp.htm) |
| Res. Ex. SII N°12/2025 | Obligaba a imprimir la boleta (efectivo o transferencia) o el voucher (tarjeta). | [Noticia SII, 27-02-2025](https://www.sii.cl/noticias/2025/270225noti01aav.htm) |
| **Res. Ex. SII N°53/2025 (29-04-2025, vigente)** | Deja sin efecto la N°12. **Efectivo o transferencia:** "deberán entregar al consumidor final la representación impresa o virtual de la boleta electrónica emitida". **Tarjeta débito, crédito o prepago:** la boleta "o comprobante de pago electrónico, dependiendo de su modelo de emisión". Lo virtual vale por correo, SMS, mensajería, QR o NFC. La sanción es la del art. 97 N°10 del Código Tributario. **Vigencia:** 01-05-2025 para quien tiene impresora y 01-03-2026 para el resto. | [Res. Ex. SII N°53/2025 (PDF oficial)](https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso53.pdf) |

**Cómo se lee para una farmacia.** En el pago con tarjeta, el voucher del POS bancario (Transbank, Getnet, SumUp, etc.) puede hacer de boleta. **Las ventas en efectivo o por transferencia, en cambio, necesitan boleta electrónica emitida por un software autorizado**, y eso es lo que LOMS 360 tendría que resolver.

### Qué necesita el comercio para emitir

| Requisito | Detalle | Fuente |
|---|---|---|
| Inicio de actividades y 1ª categoría | Requisito base para postular como emisor electrónico. | [ChileAtiende ficha 3007](https://www.chileatiende.gob.cl/fichas/3007-inscripcion-de-un-sistema-de-facturacion-electronica) |
| Certificado digital del representante legal | Es necesario para postular y para firmar los DTE. Precios publicados por terceros: $11.990 + IVA por 1 año en [SimpleAPI](https://www.simpleapi.cl/Precios) y $11.790 + IVA por 1 año en [OpenFactura](https://www.openfactura.cl/factura-electronica/precios/). | Fuentes citadas |
| Postulación como emisor | La hace solo el representante legal, autenticado con certificado digital y una sola vez por contribuyente. | [ChileAtiende](https://www.chileatiende.gob.cl/fichas/3007-inscripcion-de-un-sistema-de-facturacion-electronica) |
| Folios (CAF) | Se piden al SII. El instructivo de boleta indica "No hay cambios en la obtención de folios autorizados" respecto a la factura. | [Instructivo técnico SII](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) |
| Certificación de boleta (software propio o de mercado) | Exige estar autorizado antes como emisor de DTE o certificarse en paralelo. El set de pruebas lo pide el representante legal; luego se hacen **5 envíos** a SII_BE_Certificacion@sii.cl, con **revisión de 10–15 días hábiles**, y al final se presenta la declaración de cumplimiento. La representación impresa debe indicar el sitio web donde se verifica la boleta. | [Instructivo de certificación boleta SII](https://www.sii.cl/factura_electronica/guia_emitir_boleta_servicio.htm) |
| Envío al SII | Cada boleta se envía al SII. Para boleta hay **servicios REST** propios (semilla/token, envío, estado del envío, consulta), con un máximo de 500 boletas por envío y TLS 1.2. | [Instructivo técnico SII](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) |
| Alternativa gratuita del SII | El SII tiene app y web gratuitas para emitir boletas. Usarlas no impide emitir también con software propio o de mercado (FAQ actualizada el 20-07-2026). **No encontramos que el sistema gratuito tenga API para integrarse desde un POS.** | [FAQ SII](https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_6568.htm) · [Res. SII N°152/2020](https://www.sii.cl/normativa_legislacion/resoluciones/2020/reso152.pdf) |

### Formato de impresión térmica

| Elemento | Requisito | Fuente |
|---|---|---|
| Ancho mínimo de papel (boletas) | **5,7 cm.** Rige para boletas de contribuyentes que no prestan servicios periódicos (Res. Ex. SII N°160, 22-10-2010). | [Res. 160/2010](https://www.sii.cl/documentos/resoluciones/2010/reso160.htm) |
| Ancho mínimo (manual general de DTE) | 7,5 cm para papel continuo de POS. El manual es v3.0 de dic-2013, está pensado para facturas y dice que el de boletas "estará pronto disponible". | [Manual de muestras impresas SII](https://www.sii.cl/factura_electronica/manual_muestras_impresas.pdf) |
| Timbre electrónico | Código **PDF417**, con mínimo de **2 × 4,5 cm** en boletas. Si mide entre 2 × 4,5 y 2 × 5 cm, debe imprimirse a más de 200 dpi. Debajo lleva la leyenda "Timbre Electrónico SII", la resolución que autoriza al emisor y el sitio web de verificación. | [Res. 160/2010](https://www.sii.cl/documentos/resoluciones/2010/reso160.htm) · mismos parámetros en la [Res. 59/2013](https://www.sii.cl/documentos/resoluciones/2013/reso59.pdf), que es una autorización particular a Falabella |
| Contenido mínimo | Nombre del documento ("Boleta Electrónica"), datos del emisor, detalle legible y timbre con su leyenda. Además, el IVA va desglosado según la Res. 74/2020. | [Instructivo técnico SII](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf) · [Nubox](https://blog.nubox.com/como-emitir-boleta-electronica) (secundaria) |

**Observación nuestra, por verificar con el equipo.** Que el papel sea de 58 mm no garantiza que quepa el timbre: las impresoras de 58 mm imprimen en un área útil menor que el ancho del rollo. Antes de recomendar una, hay que comprobar con su ficha técnica que el PDF417 de 4,5 cm entra completo. Lioren vende impresoras térmicas de 58 mm a $43.000 y de 80 mm a $89.000 ([lioren.cl/precios](https://www.lioren.cl/precios)).

---

## 2. Opciones para que LOMS 360 emita boletas

**(a) Integración directa al SII.** El SII documenta una API REST de boleta ([Instructivo técnico](https://www.sii.cl/factura_electronica/factura_mercado/Instructivo_Emision_Boleta_Elect.pdf)), así que es posible sin intermediarios. A cambio, LOMS tiene que armar y firmar el XML, timbrar con el CAF, controlar los folios y pasar la certificación. Hay una librería de código abierto, [LibreDTE lib-core](https://mintlify.com/LibreDTE/libredte-lib-core/documents/boleta), que genera boletas (DTE 39). La certificación se hace por cada contribuyente emisor (cada farmacia), no una sola vez para LOMS.

**(b) Proveedor con API.** El proveedor certifica a la farmacia y LOMS llama a su API.

| Proveedor | ¿API pública para boleta? | Precio publicado | Notas |
|---|---|---|---|
| **Lioren** | **Sí.** Endpoints "POST Emisión de Boleta", consulta e índice, con token PAT, ambiente de pruebas e idempotencia ([docs](https://www.lioren.cl/docs)). | Módulo Boleta **0,1 UF/mes**, Factura 0,1 UF y "Integración API" **0 UF** ([lioren.cl/precios](https://www.lioren.cl/precios), datos embebidos en la página). La API incluye 2.500 DTE/mes; después cuesta 0,0002 UF por documento ([página API](https://www.lioren.cl/soluciones/api-boleta-y-factura-electronica)). | Boletas ilimitadas a tarifa fija. Certifica sin costo ante el SII. Pide certificado digital vigente del representante legal. **La página no dice si el precio incluye IVA.** |
| **OpenFactura (Haulmer)** | **Sí.** "Acceso API ilimitado" incluido. | Plan Pyme **$360.000 + IVA al año** (ventas menores a $200 MM/mes). Primer pago $371.790 + IVA con firma. No publica opción mensual. | Incluye todos los DTE, incluida la boleta, usuarios ilimitados, habilitación y certificación ([precios](https://www.openfactura.cl/factura-electronica/precios/)). |
| **Bsale** | **Sí.** "Conexión API" incluida en todos los planes. Plugins de terceros emiten boleta (codeSii 39) vía su API ([ejemplo](https://fastly.jsdelivr.net/wp/plugins/pwl-dte-for-bsale/trunk/readme.txt), secundaria). | Básico **1,5 UF + IVA/mes**: documentos de venta, API y 1.000 DTE ([bsale.cl/sheet/precios](https://www.bsale.cl/sheet/precios)). | Es un POS completo, un competidor más que un proveedor. La página no nombra la "boleta" explícitamente, solo "DTE". |
| **LibreDTE** | **Sí.** "Integración directa desde tu software vía nuestros servicios web". | Servicio Plus **$40.000/mes** neto, hasta 2.000 documentos, y $15 por documento adicional ([libredte.cl/plus](https://libredte.cl/plus)). | La página no aclara si el precio neto es + IVA. Ofrece prueba de 10 días. |
| **SimpleAPI** | **Parcial.** SimpleAPI-DTE genera y firma DTE por REST; la página no nombra la boleta en el producto API. Su producto hermano SimpleFactura sí emite boletas vía API, pero sin precio publicado. | SimpleAPI-DTE: gratis 12 meses (500 consultas/mes), Básico **5 UF + IVA al año** (10.000/mes), Estándar 9 UF y Premium 12 UF. "Set Boleta Electrónica" 2 UF ([precios](https://www.simpleapi.cl/Precios)). | Es una caja de herramientas: la farmacia se certifica igual, con la ayuda de SimpleAPI. |
| **Facturacion.cl (DESIS)** | **No confirmado.** Menciona integración ERP "mediante webservice", sin decir si cubre la boleta ([sitio](https://www.facturacion.cl/integracionerp)). | Boleta: **0,25 UF/mes** (0–500 boletas), 0,5 UF (501–1.500), 0,75 UF (1.501–3.000), más IVA. Incorporación $9.990 con IVA incluido ([planes](https://www.facturacion.cl/?Planes)). | El más barato publicado, pero hay que confirmar la API. |
| **Nubox** | **No encontrado.** El sitio no menciona API. | "Desde 1 UF + IVA c/u" por sistema ([nubox.com](https://www.nubox.com/)). Los tramos por DTE solo aparecen en un agregador sin fecha ([FitGap](https://us.fitgap.com/products/047053/nubox-fe), dudoso). | Orientado a contadores y pymes; no sirve como motor embebido. |
| **Defontana** | **No encontrado** para boleta. Tiene página de [integraciones](https://www.defontana.com/cl/integraciones). | POS Tivendo desde 1,5 UF + IVA/mes ([pos-tivendo](https://www.defontana.com/cl/pos-tivendo)). | Es un ERP o POS competidor, no un proveedor de emisión. |

---

## Qué recomendamos (opinión nuestra, no dato)

1. **Para el MVP con Farmacia Luis Gabriel, integrar Lioren por API.** Es el costo publicado más bajo con API confirmada para boleta: unas 0,3 UF/mes por Boleta, Factura y Nota de crédito (≈ $12.358 ≈ 12,7 USD). Además es tarifa fija, Lioren certifica sin costo y la API trae ambiente de pruebas. La alternativa es OpenFactura, a ≈ $30.000/mes equivalente pero con pago anual adelantado.
2. **Diseñar la integración detrás de una interfaz propia** (`EmisorDTE`) para poder cambiar de proveedor o pasar a integración directa con el SII cuando haya volumen.
3. **No ir a integración directa con el SII ahora.** Habría que certificar a cada farmacia (10–15 días hábiles por set) y asumir la custodia de certificados y CAF. Tiene sentido recién con muchos clientes.
4. **Emitir boleta en todo pago en efectivo y transferencia, y dejar configurable el pago con tarjeta.** Si la farmacia usa POS bancario con voucher, no se emite boleta para esa venta. Si no, se emite.
5. **Imprimir en 80 mm por defecto.** Así hay margen para el PDF417 de 4,5 cm, y además ofrecer el envío virtual (correo o WhatsApp), que la Res. 53/2025 acepta.

## Qué falta confirmar

- Si los precios de Lioren llevan IVA encima, y cuántos usuarios incluye la suscripción base. La página no lo dice; hay que preguntar a Lioren.
- Cuántas boletas al mes emite Farmacia Luis Gabriel. No tenemos el dato y define si conviene tarifa fija (Lioren) o por tramo (Facturacion.cl).
- Si Facturacion.cl y SimpleAPI-DTE emiten boleta (DTE 39) por API.
- Si hubo prórroga o cambios posteriores al plazo del 01-03-2026 de la Res. 53/2025. No encontramos normativa posterior, pero no hicimos una búsqueda exhaustiva en sii.cl.
- Si la Res. 160/2010 (5,7 cm) sigue siendo la norma de formato vigente para boletas o si la reemplazó otra. El manual general de muestras impresas es de 2013.
- Qué medio de pago con tarjeta usa la farmacia y si su voucher ya opera como boleta.
