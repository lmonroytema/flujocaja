# Guion: video de capacitación Flujo Caja (FC-HUB) por perfiles

**Archivo:** `FlujoCaja_Demo_Perfiles.mp4` (1600×900, H.264 + AAC, 9:12).
- Tiene **narración en español** con voz es-PE. La locución es el mismo texto de cada subtítulo.
- En las pantallas de título, la voz lee el título y presenta el contenido.
- Los subtítulos van incrustados y también hay una copia en `FlujoCaja_Demo_Perfiles.srt`.
**Entorno:** se grabó en local con datos ficticios (SQLite y una API de Compras simulada). No se usó producción.

## Perfiles que existen en el sistema

Los perfiles están en el campo `users.profile`, que se valida en `UserManagementController`. Hay cuatro: `admin`, `directivo`, `finanzas` y `operaciones`.

| Menú / función | Admin | Directivo | Finanzas | Operaciones |
|---|:-:|:-:|:-:|:-:|
| Dashboard, Importaciones, Proyectos, Flujo de caja, Tipos de cambio | ✔ | ✔ | ✔ | ✔ |
| Gastos compras, Finanzas órdenes, Mi seguridad | ✔ | ✔ | ✔ | ✔ |
| **Usuarios** (crear, cambiar perfil, 2FA, restablecer) | ✔ | — | — | — |
| **API compras** (configurar y probar conexión) | ✔ | — | — | — |

En el código, la única diferencia técnica es *admin* frente a *no admin*: el middleware `admin` y `adminOnly` en `AppShell.tsx`. Directivo, Finanzas y Operaciones ven las mismas pantallas, así que el video muestra en cada perfil las tareas típicas de su rol, siguiendo las descripciones de la pantalla de ingreso.

## Usuarios de prueba (solo en el entorno demo local)

| Perfil | Correo | Particularidad |
|---|---|---|
| Admin | lmonroy@tema.com.pe (clave de prueba 12345678) | 2FA activa (código OTP) |
| Directivo | directivo.demo@flujocaja.test | ingreso normal |
| Finanzas | finanzas.demo@flujocaja.test | ingreso normal |
| Operaciones | operaciones.demo@flujocaja.test | primer ingreso con restablecimiento de contraseña |

Las claves de prueba están en `scripts/preparar_demo.php` y solo existen en la base SQLite del demo. Los datos de proyectos e hitos son ficticios.

---

## 0. Introducción (unos 55 s)
1. **Título:** «Flujo Caja · FC-HUB. Recorrido por las funciones de la aplicación según el perfil de cada usuario.»
2. **Título:** «Cuatro perfiles de acceso». Tarjetas para Administrador, Directivo, Finanzas y Operaciones.
3. **Pantalla de ingreso:** «Esta es la pantalla de ingreso. Aquí se presentan los perfiles de acceso de la plataforma.» Se recorren las tarjetas Directivo, Finanzas y Operaciones.
4. «A la derecha está el formulario “Acceso seguro” y el enlace “Olvidé mi contraseña”.»
5. «Si olvidas tu contraseña, el sistema te envía un código de restablecimiento al correo.»

## 1. Perfil Administrador (unos 1:55)
1. **Título:** Administrador. Inicio con 2FA, Usuarios, API compras y resto de módulos.
2. **Inicio de sesión con OTP:** se ingresan el correo y la contraseña. Aparece el mensaje «Con doble autenticación activa, el sistema envía un código de 6 caracteres a tu correo». Se escribe el código y se pulsa «Verificar y continuar».
3. **Dashboard:** «El administrador ve dos opciones exclusivas en el menú: “API compras” y “Usuarios”.»
4. **Usuarios:**
   - Se muestra la lista de cuentas.
   - Se crea el usuario *Valeria Demo Finanzas* con el perfil Finanzas.
   - Se explica que el usuario nuevo deberá restablecer su contraseña en su primer ingreso.
   - Se explica que desde la lista se cambia el perfil, se activa o desactiva la 2FA y se usa «Restablecer».
5. **API compras:**
   - Se escriben la Base URL y el Public Token.
   - Se pulsa «Probar conexión» y aparece «Conexión validada correctamente».
   - Se pulsa «Guardar configuración». El token no se vuelve a mostrar.
6. **Mi seguridad:** cambio de contraseña y activación o desactivación de 2FA.
7. **Salir.**

## 2. Perfil Finanzas (unos 2:40)
1. **Título:** Finanzas. Importaciones, Flujo de caja, Tipos de cambio y Compras.
2. **Inicio de sesión** normal.
3. **Dashboard:** ingresos del mes, proyectos activos, hitos urgentes y cobrados, y los próximos cobros.
4. **Importaciones:**
   - Se carga el Excel de proyectos. Luego se carga el Excel de hitos de pago.
   - Se muestra el resultado de cada carga: filas insertadas, actualizadas y omitidas.
   - Se muestra el historial de cargas.
5. **Flujo de caja:**
   - Se explica que hay una fila por proyecto y que los hitos se ubican por semana y se agrupan por mes.
   - Se usa el período rápido «Próximos 3 meses».
   - Se muestran los indicadores por moneda.
   - Se hace clic en una celda para ver el detalle de los hitos de esa semana.
   - Se señala el botón «Exportar Excel».
6. **Tipos de cambio:** tipo de cambio semanal USD → PEN, que se guarda al salir del campo.
7. **Gastos compras:** se pulsa «Aplicar filtros» y se ven compras, servicios, compromiso, facturado y pagado por semana.
8. **Finanzas órdenes:**
   - Se consulta la orden `OC-26-1617` y se ven el monto comprometido, facturado, pagado y los saldos.
   - Se registra una facturación parcial (fecha, importe y número de factura).
   - Se explica que los pagos se registran de la misma forma.
9. **Salir.**

## 3. Perfil Directivo (unos 1:30)
1. **Título:** Directivo. Dashboard, Flujo de caja, Proyectos y Gastos compras.
2. **Inicio de sesión.** Se explica que el menú no incluye «Usuarios» ni «API compras».
3. **Dashboard:** lectura ejecutiva.
4. **Flujo de caja:** con «Próximos 12 meses», la vista adaptativa agrupa por mes o por trimestre. Se explica que un clic en el encabezado de un período muestra sus semanas.
5. **Proyectos:** cartera con cliente, unidad, moneda, avance y margen.
6. **Gastos compras:** egresos semanales por proyecto y categoría.
7. **Salir.**

## 4. Perfil Operaciones (unos 1:45)
1. **Título:** Operaciones. Primer ingreso, Proyectos, Flujo de caja y Mi seguridad.
2. **Primer ingreso:**
   - El sistema pide restablecer la contraseña.
   - Se abre la ventana y llega un código al correo.
   - Se escriben el código, la nueva contraseña y su confirmación, y se pulsa «Continuar».
   - Después se ingresa al Dashboard.
3. **Proyectos:** validación de la cartera. Se filtra por el coordinador «Ana Demo» y luego se pulsa «Limpiar filtros».
4. **Flujo de caja:** la leyenda de estados va de «No iniciado» a «Cobrado». Se usa el filtro «Solo proyectos con discrepancias de estado».
5. **Mi seguridad:** se activa la 2FA. Desde ese momento cada ingreso pedirá un código.
6. **Salir.**

## 5. Cierre (unos 30 s)
1. **Título:** «¿Qué ve cada perfil?».
   - Todos los perfiles: los módulos operativos y Mi seguridad.
   - Solo el Administrador: Usuarios y API compras.
   - Seguridad: código de restablecimiento en el primer ingreso y 2FA opcional.
   - Soporte: ante dudas, contactar al administrador.
2. **Título:** «¡Gracias!».
