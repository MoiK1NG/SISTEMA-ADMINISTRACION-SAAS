# Salir a producción cuesta unos 46 USD al mes, y no es opcional: los Términos de Vercel prohíben usar Hobby con fines comerciales

**LOMS 360 · Investigación 04 · Costos para salir a producción**
Consultado el 21-10-2026. Precios en USD tal como los publica cada proveedor, sin impuestos salvo que se indique. Dólar de referencia para convertir CLP: $972,60 (SII, 01-10-2026).

---

## Lo esencial

1. **Vercel Hobby no sirve para LOMS 360.** Los Términos (sección 4, actualizados el 19-10-2026) dicen: *"You shall only use the Services under a Hobby plan for your personal or non-commercial use."* La guía de uso justo define como comercial cualquier despliegue que genere ganancia a alguien involucrado, incluido cobrar a los visitantes ([Términos](https://vercel.com/legal/terms) · [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines)). **Pro: 20 USD por desarrollador al mes.**
2. **El plan gratuito de Supabase no es apto para un cliente que paga:** no tiene backups automáticos, pausa el proyecto tras 1 semana sin actividad y limita la base a 500 MB. **Pro: desde 25 USD/mes**, con backups diarios por 7 días.
3. **Dominio, correo transaccional y correo corporativo pueden costar casi cero al inicio** si se usa el .cl de NIC Chile ($9.990/año), el plan gratuito de Resend y el plan gratuito de Zoho.

---

## 1. Hosting y base de datos (dato con fuente)

### Supabase — [supabase.com/pricing](https://supabase.com/pricing)

| | Free | Pro |
|---|---|---|
| Precio | 0 USD | **desde 25 USD/mes** |
| Base de datos | 500 MB (CPU compartida, 500 MB RAM) | 8 GB de disco por proyecto, luego 0,125 USD/GB |
| Egress | 5 GB (+ 5 GB en caché) | 250 GB, luego 0,09 USD/GB |
| Almacenamiento de archivos | 1 GB | 100 GB |
| Usuarios activos/mes | 50.000 | (no revisado) |
| **Pausa por inactividad** | **"Free projects are paused after 1 week of inactivity"** | No aplica |
| Proyectos | 2 activos | Cómputo Micro incluido; trae 10 USD/mes de créditos de cómputo |
| **Backups** | **No incluye automáticos.** Supabase recomienda exportar con `supabase db dump` ([docs backups](https://supabase.com/docs/guides/platform/backups)). | **Diarios, guardados 7 días.** PITR opcional ≈ 100 USD/mes. |

Cada proyecto extra en Pro, por ejemplo uno de staging, consume cómputo propio: una instancia Micro cuesta ≈ 10 USD/mes y una Small ≈ 15 USD/mes ([docs cómputo](https://supabase.com/docs/guides/platform/compute-and-disk)).

### Vercel — [vercel.com/pricing](https://vercel.com/pricing) · [Plan Hobby](https://vercel.com/docs/plans/hobby) · [Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)

| | Hobby | Pro |
|---|---|---|
| Precio | 0 USD | **20 USD/mes por asiento de desarrollador** (los asientos Viewer son gratis). Trae 20 USD de crédito de uso. |
| **Uso comercial** | **Prohibido** (Términos §4 y Fair Use) | Permitido |
| Cron jobs | 100 por proyecto, **1 vez al día como máximo**, con precisión de ±59 min | 100 por proyecto, cada 1 minuto, con precisión al minuto |
| Logs de ejecución | 1 hora | 1 día |
| Despliegues por día | 100 | 6.000 |
| Soporte por correo | No | Sí |
| Dominio | — | Un dominio gratis el primer año en TLD elegibles |

## 2. Dominio

| Dominio | Precio publicado | Fuente |
|---|---|---|
| **.cl** (NIC Chile) | **$9.990 por 1 año**, $19.980 por 2 y $29.970 por 3. **Exento de IVA.** Vigente desde el 01-11-2023. | [nic.cl/dominios/tarifas](https://www.nic.cl/dominios/tarifas.html) |
| **.com** | Cloudflare Registrar cobra a costo, sin margen ([Cloudflare](https://www.cloudflare.com/products/registrar/)), pero no publica la cifra en esa página. El costo mayorista con la tarifa ICANN incluida es **≈ 10,46 USD/año hasta el 31-10-2026** y **≈ 11,17–11,18 USD/año desde el 01-11-2026** (alza de Verisign). | [OpenProvider, 09-09-2026](https://www.openprovider.com/blog/com-price-increase-domain-resellers) · [tldes](https://tldes.com/pages/com-price-increase-2026). Fuentes secundarias con leves diferencias entre sí. |

## 3. Correo transaccional

| Servicio | Plan gratis | Primer plan pago | Fuente |
|---|---|---|---|
| **Resend** | 3.000 correos/mes, **tope de 100/día**, 3 dominios | Pro **20 USD/mes**: 50.000 correos, luego 0,90 USD por cada 1.000 | [resend.com/pricing](https://resend.com/pricing) |
| **Amazon SES** | Hasta 200 USD en créditos del Free Tier de AWS, usables en 6 meses (cuentas nuevas) | À la carte **0,10 USD por 1.000 correos**, sin mínimo. Adjuntos: 0,12 USD/GB. | [aws.amazon.com/ses/pricing](https://aws.amazon.com/ses/pricing/) |
| **Postmark** | 100 correos/mes | Basic **15 USD/mes**: 10.000 correos, luego 1,80 USD por cada 1.000 | [postmarkapp.com/pricing](https://postmarkapp.com/pricing) |

## 4. Correo corporativo

| Servicio | Precio por usuario/mes | Fuente y calidad |
|---|---|---|
| **Zoho Mail – Forever Free** | **0**: hasta 5 usuarios, 5 GB c/u, 1 dominio, solo web (sin IMAP/POP). "Solo disponible en determinados centros de datos". | [zoho.com/mail](https://www.zoho.com/mail/zohomail-pricing.html), oficial |
| Zoho Mail Lite | ≈ 1 USD (facturación anual, sin plan mensual) | La página oficial carga el precio por script y no lo pudimos leer. La cifra viene de terceros ([Capterra](https://www.capterra.com/p/174694/Zoho-Mail/pricing/)), **no confirmada**. |
| **Google Workspace Business Starter** | **7 USD** con compromiso anual · 8,40 USD flexible · 30 GB | [Email Vendor Selection, 22-06-2026](https://www.emailvendorselection.com/google-workspace-pricing/) (secundaria). La página oficial, vista desde Colombia, muestra **COP 29.200** (o COP 26.280 de lanzamiento para los primeros 20 usuarios, del 04-11-2026 al 04-11-2027), más impuestos ([workspace.google.com/pricing](https://workspace.google.com/pricing)). |
| **Microsoft 365 Business Basic** | **7 USD** desde el 01-07-2026 (antes 6 USD) | [Office Watch, 08-07-2026](https://office-watch.com/2026/microsoft-365-business-price-increase-2026/) (secundaria). La página de Microsoft no cargó en la consulta. |

---

## 5. Costo mensual mínimo recomendado (cálculo nuestro con precios publicados)

| Ítem | Opción recomendada | USD/mes |
|---|---|---|
| Hosting | Vercel Pro, 1 asiento | 20,00 |
| Base de datos | Supabase Pro (1 proyecto, Micro incluido) | 25,00 |
| Dominio | .cl en NIC Chile ($9.990/año ÷ 12 = $833) | 0,86 |
| Correo transaccional | Resend Free (3.000/mes, 100/día) | 0,00 |
| Correo corporativo | Zoho Mail Forever Free (hasta 5 usuarios) | 0,00 |
| **Total mínimo** | | **≈ 45,86** |
| *Variante* | + .com (≈ 0,93/mes) y Google Workspace Starter con 2 usuarios (14) | ≈ 60,79 |
| *Al crecer* | + Resend Pro (20) y + proyecto de staging en Supabase (≈ 10) | ≈ 75,86 – 90,79 |

No incluye impuestos: Vercel factura sin IVA y lo agrega según la dirección de facturación. Tampoco incluye uso por encima de lo incluido ni el costo del proveedor de boletas (ver doc. 01).

## Qué recomendamos (opinión nuestra, no dato)

1. **Pasar a Vercel Pro y Supabase Pro antes de cobrarle a Farmacia Luis Gabriel.** Estar en Hobby incumple los Términos de Vercel, y en Supabase Free un dato perdido no tiene backup.
2. **Mientras tanto, si se sigue en Free:** programar un `supabase db dump` diario fuera de Supabase y verificar que la app tenga actividad semanal para evitar la pausa.
3. **Revisar los cron jobs.** En Hobby solo corren una vez al día, con hasta 59 min de desfase. Cualquier alerta de vencimientos o tarea que deba correr más seguido necesita Pro.
4. **Registrar el .cl** (útil para clientes chilenos y exento de IVA) y usar el dominio gratis del primer año de Vercel Pro para el .com, si es elegible.
5. **Correo:** Resend Free alcanza para avisos y recuperación de contraseña de 1 cliente. Para correo del equipo, Zoho Free alcanza hasta 5 personas. Google Workspace solo se justifica si ya lo usan.

## Qué falta confirmar

- El precio oficial en USD de Google Workspace, Microsoft 365 y Zoho Mail Lite: las páginas oficiales cargan el precio por script o por país.
- El precio final del .com en el registrador que elijamos. Las cifras de la tabla son costo mayorista según fuentes secundarias.
- Si Supabase Pro cobra por organización o si cada cliente tendría proyecto propio: define cuánto escala el costo de cómputo.
- El tamaño real de la base de datos y el egress de la farmacia, para saber si 8 GB y 250 GB alcanzan. Hoy no medimos ese dato.
