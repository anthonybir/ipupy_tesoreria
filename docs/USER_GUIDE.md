# Guía de Usuario - Sistema de Tesorería IPU PY

## Bienvenido al Sistema de Tesorería Nacional

Esta guía está diseñada para tesoreros, pastores y administradores de las iglesias de la **Iglesia Pentecostal Unida del Paraguay** que utilizarán el sistema de tesorería centralizado.

### Tabla de Contenidos
- [Acceso al Sistema](#acceso-al-sistema)
- [Dashboard Principal](#dashboard-principal)
- [Gestión de Iglesias](#gestión-de-iglesias)
- [Sistema de Reportes Mensuales](#sistema-de-reportes-mensuales)
- [Libro Mensual – Centro de Control](#libro-mensual--centro-de-control)
- [Registrar Informe Manual (Tesorería Nacional)](#registrar-informe-manual-tesorería-nacional)
- [Conciliación de Fondos](#conciliación-de-fondos)
- [Preguntas Frecuentes](#preguntas-frecuentes)

## Acceso al Sistema

### 🌐 URL del Sistema
**Producción**: [https://ipupytesoreria.vercel.app](https://ipupytesoreria.vercel.app)

### 🔐 Métodos de Acceso

#### Opción 1: Cuenta Google (@ipupy.org.py)
1. Click en "Iniciar Sesión con Google"
2. Usar su cuenta oficial @ipupy.org.py
3. Autorizar el acceso al sistema

#### Opción 2: Email y Contraseña
1. Ingresar email registrado
2. Ingresar contraseña
3. Click en "Iniciar Sesión"

### 📱 Acceso Móvil
El sistema funciona perfectamente en:
- ✅ Teléfonos Android e iPhone
- ✅ Tablets iPad y Android
- ✅ Computadoras de escritorio
- ✅ Laptops y netbooks

---

## Dashboard Principal

### 📊 Resumen Ejecutivo
Al ingresar verá:

#### Tarjetas de Resumen
- **Total Iglesias**: 22 iglesias IPU Paraguay
- **Ingresos del Mes**: Suma total de todas las iglesias
- **Fondo Nacional**: 10% calculado automáticamente
- **Reportes Pendientes**: Iglesias que faltan reportar

#### Gráficos y Estadísticas
- **Tendencia Mensual**: Comparación con meses anteriores
- **Top 5 Iglesias**: Mayores contribuidoras del mes
- **Distribución por Departamento**: Geográfica de ingresos
- **Cumplimiento**: Porcentaje de iglesias que reportaron

---

## Gestión de Iglesias

### 📋 Lista de Iglesias

#### Ver Todas las Iglesias
1. Menú → "Iglesias"
2. Verá las 22 iglesias registradas
3. Información mostrada:
   - Nombre de la iglesia
   - Ciudad/Departamento
   - Pastor titular
   - Grado ministerial
   - Estado (Activa/Inactiva)
   - Último reporte enviado

#### Buscar Iglesia Específica
1. Usar el cuadro de búsqueda
2. Buscar por:
   - Nombre de iglesia
   - Ciudad
   - Nombre del pastor
   - Cédula de identidad

#### Ver Detalles de una Iglesia
1. Click en cualquier iglesia de la lista
2. Información detallada:
   - **Datos básicos**: Nombre, ubicación, contacto
   - **Información pastoral**: Pastor, grado, posición
   - **Documentos legales**: RUC, cédula, personería jurídica
   - **Historial financiero**: Reportes de los últimos 12 meses
   - **Estadísticas**: Promedio mensual, crecimiento, consistencia

---

## Sistema de Reportes Mensuales

### 📄 Crear Nuevo Reporte (Portal de Iglesias)

1. Menú → `Reportes` → `Nuevo Reporte`.
2. Selecciona tu iglesia, mes y año. El sistema bloqueará meses que ya tienen informe aprobado.
3. Completa los campos de ingresos (diezmos, ofrendas, departamentos, anexos y otros). Todo se registra en guaraníes.
4. Declara las ofrendas designadas (Misiones, Lazos de Amor, Misión Posible, APY, IBA, Caballeros, Damas, Jóvenes, Niños). Estas cifras pasan 100% al nivel nacional y se reflejan en la sección de salidas automáticamente.
5. Registra los gastos operativos (energía eléctrica, agua, basura, servicios, mantenimiento, materiales, otros gastos). No es necesario escribir el honorario pastoral: el sistema lo calcula como el remanente para que el saldo del mes sea cero.
6. Ingresa datos del depósito (número, fecha y monto). El monto debe coincidir con el 10% nacional + ofrendas designadas transferidas.
7. Adjunta fotos (opcional pero recomendado): resumen firmado y comprobante de depósito.
8. Completa estadísticas pastorales (asistencia, bautismos) y observaciones.
9. Revisa el panel "Resumen Calculado". Si `Saldo del Mes` aparece en verde (Gs. 0), el informe está balanceado.
10. Presiona `Enviar`. El estado inicial será `pendiente_admin` y la tesorería nacional recibirá una notificación.

### 🧾 Registro de Aportantes (Diezmos)
- Botón `Agregar aportante` para cada donante.
- Se exige al menos uno cuando `diezmos > 0`.
- La suma de los montos debe coincidir exactamente con el total de diezmos (tolerancia ±1 Gs para redondeo).
- Se debe informar **nombre** o **apellido** o **documento** por aportante.

### Validaciones Automáticas
- 10% nacional calculado sobre `diezmos + ofrendas`.
- Honorario pastoral = ingresos totales – (diezmo nacional + designados + gastos operativos).
- No se permite saldo negativo o diferencia entre aportantes y diezmos.
- Se bloquean reportes duplicados por iglesia/mes/año.

### Estados del Reporte
| Estado | Quién lo establece | Significado |
|--------|-------------------|-------------|
| `pendiente_admin` | Iglesia / Tesorería | Informe listo para revisión nacional. |
| `procesado` | Tesorería | Aprobado y con transacciones generadas. |
| `rechazado_admin` | Tesorería | Requiere correcciones; se incluye comentario. |
| `importado_excel` | Script | Registros históricos migrados. |

### Ciclo de Aprobación
1. La iglesia envía el informe (`pendiente_admin`).
2. El tesorero lo revisa en **Libro Mensual → Procesar informes**.
3. Si todo está correcto, aprueba → se crean transacciones y las tarjetas de fondos se actualizan.
4. Si encuentra inconsistencias, lo rechaza con notas. La iglesia corrige y vuelve a enviar.

---

## Libro Mensual – Centro de Control

El módulo Libro Mensual reúne todas las tareas del tesorero nacional.

### Tab 1 · Procesar informes
1. Abre `Libro Mensual` → `Procesar informes`.
2. La parte superior muestra el resumen (pendientes, total designado por aprobar).
3. Cada fila incluye: ingreso total, designados, gastos operativos y enlaces rápidos.
4. Acciones disponibles:
   - `Revisar`: abre el detalle con ingresos, egresos, aportantes y fotos.
   - `Aprobar rápido`: genera transacciones automáticas y marca el informe como `procesado`.
   - `Rechazar`: requiere observación e informa a la iglesia.
5. El botón `Informe Manual` abre el formulario para cargar reportes recibidos fuera de línea.

### Tab 2 · Transacciones externas
- Formulario para registrar pagos a proveedores, eventos, conferencias o transferencias entre fondos.
- Campos clave: fondo destino, concepto, monto (entrada o salida), proveedor y documento.
- El historial muestra los últimos 100 movimientos manuales y se actualiza al enviar una nueva transacción.

### Tab 3 · Conciliación
- Presenta cada fondo con: saldo almacenado, saldo recalculado desde transacciones, diferencia, cantidad de movimientos y fecha del último movimiento.
- Filtro por fondo disponible (pestaña superior izquierda).
- Indicadores
  - `Conciliado` (verde): saldo coincidente.
  - `Revisar` (rojo): diferencia distinta de cero; revisar transacciones asociadas.

## Registrar Informe Manual (Tesorería Nacional)

Cuando un pastor envía cifras por WhatsApp, papel o llamada telefónica:

1. `Libro Mensual` → `Procesar informes` → botón `Informe Manual`.
2. Selecciona la iglesia, mes y año correspondientes.
3. En `Fuente del Informe` indica cómo se recibió (papel, WhatsApp, email, teléfono, en persona u otro) y agrega notas.
4. Captura ingresos, designados y gastos igual que en el formulario congregacional (los cálculos son automáticos).
5. Registra aportantes de diezmos tal como se recibieron:
   - `Agregar aportante` por cada diezmo registrado.
   - Asegúrate de informar al menos nombre/apellido/documento y que la suma coincida con el total de diezmos.
6. Guarda el depósito (si ya fue entregado) o agrégalo después.
7. El informe queda en `pendiente_admin`, con auditoría (`entered_by`) del tesorero que lo digitó.
8. Regresa a la lista y aprueba cuando verifiques la documentación. El sistema generará: transferencia 10%, movimientos designados y honorario pastoral.

> Nota: Si el pastor aún no realizó el depósito, conserva el estado `pendiente_admin` y agrega la nota correspondiente en `Observaciones`.

## Conciliación de Fondos

Utiliza la pestaña `Conciliación` después de cierres mensuales o ajustes especiales.

1. Verifica la columna `Diferencia`.
2. Si aparece un valor distinto de cero:
   - Abre `Transacciones externas` para confirmar si falta registrar un pago.
   - Observa `último movimiento` para identificar el día con desbalance.
3. Los ajustes del 31/12/2024 aparecen como "Ajuste de saldo - Reconciliación Excel". No eliminarlos: sirven como base oficial 2025.
4. Si realizas un ajuste manual nuevo, registra el motivo en el campo `Concepto` y conserva comprobantes.

> Consejo: exporta el libro diario mensual antes de cerrar para mantener respaldo fuera del sistema.

## Importación desde Excel

### 📥 Importar Reportes Existentes

#### Formatos Soportados
El sistema acepta archivos Excel (.xlsx) con:
- Reportes mensuales individuales
- Reportes anuales consolidados
- Listas de iglesias
- Registros de miembros

#### Proceso de Importación
1. Menú → "Importar" → "Desde Excel"
2. Seleccionar archivo Excel de su computadora
3. Elegir tipo de importación:
   - **Reporte Mensual**: Un mes específico
   - **Múltiples Meses**: Varios meses en un archivo
   - **Datos de Iglesias**: Información de iglesias
   - **Lista de Miembros**: Base de datos de miembros

4. Mapear columnas:
   - El sistema detecta automáticamente las columnas
   - Verificar que coincidan con los campos correctos
   - Ajustar si es necesario

5. Validar datos:
   - El sistema verifica errores automáticamente
   - Muestra advertencias sobre datos inconsistentes
   - Lista errores que deben corregirse

6. Confirmar importación:
   - Revisar el resumen de importación
   - Confirmar para procesar
   - Ver resultado final con estadísticas

#### Errores Comunes y Soluciones

**Error: "Monto inválido"**
- **Causa**: Texto en lugar de números
- **Solución**: Usar solo números, sin letras ni símbolos

**Error: "Fecha incorrecta"**
- **Causa**: Formato de fecha no reconocido
- **Solución**: Usar formato DD/MM/AAAA

**Error: "Iglesia no encontrada"**
- **Causa**: Nombre de iglesia no coincide exactamente
- **Solución**: Usar nombres exactos de la lista oficial

---

## Exportación a Excel

### 📤 Generar Reportes en Excel

#### Tipos de Exportación Disponibles

**1. Reporte Mensual Individual**
1. Ir a "Reportes" → "Exportar"
2. Seleccionar "Reporte Mensual"
3. Elegir iglesia, mes y año
4. Click "Descargar Excel"

**Contenido del archivo**:
- Hoja 1: Resumen ejecutivo
- Hoja 2: Detalle de entradas
- Hoja 3: Detalle de salidas
- Hoja 4: Fondo nacional
- Hoja 5: Balance final

**2. Resumen Anual Completo**
1. Seleccionar "Resumen Anual"
2. Elegir año
3. Opcional: Filtrar por iglesias específicas

**Contenido del archivo**:
- Hoja 1: Resumen ejecutivo anual
- Hoja 2: Mes a mes por iglesia
- Hoja 3: Comparación entre iglesias
- Hoja 4: Tendencias y análisis
- Hoja 5: Fondo nacional consolidado

**3. Lista de Iglesias**
- Información completa de las 22 iglesias
- Datos pastorales actualizados
- Información legal y contacto

**4. Análisis Financiero**
- Métricas de rendimiento
- Comparaciones históricas
- Análisis de crecimiento
- Indicadores de salud financiera

#### Personalizar Exportación
- **Rango de fechas**: Seleccionar período específico
- **Iglesias**: Filtrar iglesias específicas
- **Moneda**: Guaraníes o USD (tipo de cambio automático)
- **Formato**: Seleccionar template oficial IPU

---

## Gestión de Miembros

### 👥 Registro de Miembros

#### Agregar Nuevo Miembro
1. Menú → "Miembros" → "Nuevo Miembro"
2. Seleccionar iglesia
3. Completar información:

**Datos Personales**
- Nombre completo
- Cédula de identidad
- Fecha de nacimiento
- Teléfono y email
- Dirección completa

**Información Espiritual**
- Fecha de conversión
- Fecha de bautismo en agua
- Fecha de bautismo del Espíritu Santo
- Fecha de membresía oficial

**Información Familiar**
- Estado civil
- Cónyuge (si está casado/a)
- Hijos dependientes
- Familia en la iglesia

#### Actualizar Información
- Buscar miembro por nombre o cédula
- Click "Editar" en la información
- Actualizar campos necesarios
- Guardar cambios

#### Estadísticas de Membresía
- Total de miembros activos
- Nuevos miembros del año
- Bautismos realizados
- Distribución por edades
- Crecimiento mensual

---

## Gestión de Familias

### 👨‍👩‍👧‍👦 Organización Familiar

#### Crear Nueva Familia
1. Menú → "Familias" → "Nueva Familia"
2. Información básica:
   - Apellido familiar
   - Cabeza de familia
   - Dirección
   - Teléfono principal

#### Agregar Miembros a Familia
- Buscar miembros existentes
- Asignar roles familiares
- Especificar relaciones
- Actualizar datos de contacto

#### Beneficios del Sistema Familiar
- Comunicación más eficiente
- Estadísticas familiares
- Organización de eventos
- Seguimiento pastoral

---

## Transacciones Financieras

### 💰 Registro de Movimientos

#### Tipos de Transacciones

**Entradas**
- Diezmos regulares
- Ofrendas generales
- Ofrendas especiales
- Eventos y actividades
- Donaciones externas

**Salidas**
- Honorarios pastorales
- Servicios básicos
- Gastos administrativos
- Proyectos de construcción
- Ayuda social

#### Registrar Nueva Transacción
1. Menú → "Transacciones" → "Nueva"
2. Seleccionar tipo (Entrada/Salida)
3. Completar información:
   - Fecha de la transacción
   - Monto en guaraníes
   - Categoría específica
   - Descripción detallada
   - Comprobante (si aplica)

#### Consultar Movimientos
- Filtrar por fecha, tipo, categoría
- Buscar por monto o descripción
- Exportar a Excel
- Ver totales por período

---

## Configuración de Usuario

### ⚙️ Personalización del Sistema

#### Cambiar Contraseña
1. Menú usuario → "Configuración"
2. "Cambiar Contraseña"
3. Ingresar contraseña actual
4. Nueva contraseña (mínimo 8 caracteres)
5. Confirmar nueva contraseña

#### Preferencias de Notificación
- Email para reportes pendientes
- Recordatorios de fechas límite
- Alertas de discrepancias
- Resúmenes semanales

#### Configuración Regional
- Zona horaria: América/Asunción
- Moneda: Guaraní paraguayo (₲)
- Formato de fecha: DD/MM/AAAA
- Idioma: Español (Paraguay)

---

## Ayuda y Soporte

### 🆘 Resolución de Problemas

#### Problemas Comunes

**No puedo iniciar sesión**
1. Verificar email correcto
2. ¿Olvidó su contraseña? → "Recuperar contraseña"
3. ¿Cuenta nueva? → Contactar administrador
4. ¿Problema con Google? → Verificar cuenta @ipupy.org.py

**El sistema está lento**
1. Verificar conexión a internet
2. Cerrar otras pestañas del navegador
3. Actualizar la página (F5)
4. Limpiar caché del navegador

**Error al subir archivos**
1. Verificar tamaño máximo: 10MB
2. Formato permitido: .xlsx, .jpg, .png
3. Conexión estable requerida
4. Reintentar la subida

**Números no se calculan bien**
1. Usar solo números (sin letras)
2. Punto para decimales (no coma)
3. No usar símbolos de moneda
4. Verificar que todos los campos estén completos

#### Contacto para Soporte

**Administrador del Sistema**
- **Email**: administracion@ipupy.org.py
- **Teléfono**: +595 21 123-456
- **Horario**: Lunes a Viernes, 8:00 - 17:00

**Soporte Técnico**
- **GitHub**: [Reportar problema técnico](https://github.com/anthonybirhouse/ipupy-tesoreria/issues)
- **Email técnico**: soporte@ipupy.org.py

**Capacitación y Entrenamiento**
- **Solicitar capacitación**: capacitacion@ipupy.org.py
- **Manual impreso**: Disponible en oficinas IPU
- **Videos tutoriales**: En desarrollo

---

## Mejores Prácticas

### ✅ Recomendaciones para Tesoreros

#### Reportes Mensuales
1. **Puntualidad**: Enviar antes del día 5 de cada mes
2. **Precisión**: Verificar todos los números dos veces
3. **Comprobantes**: Guardar todos los documentos de respaldo
4. **Backup**: Tener copia física de reportes importantes

#### Seguridad
1. **Contraseñas**: Usar contraseñas fuertes y únicas
2. **Acceso**: No compartir credenciales de acceso
3. **Sesiones**: Cerrar sesión al terminar
4. **Dispositivos**: Solo usar equipos confiables

#### Organización
1. **Carpetas**: Organizar archivos por mes y año
2. **Nombres**: Usar nombres descriptivos para archivos
3. **Fechas**: Siempre verificar fechas antes de enviar
4. **Revisión**: Revisar datos antes de aprobar

### 📅 Calendario de Actividades

#### Actividades Mensuales
- **Día 1-3**: Recopilar información del mes anterior
- **Día 4-5**: Completar y enviar reporte mensual
- **Día 6-10**: Revisión y aprobación por administración
- **Día 15**: Depósito del fondo nacional
- **Día 20**: Verificación de depósito en sistema

#### Actividades Anuales
- **Enero**: Resumen anual del año anterior
- **Marzo**: Revisión de proyecciones
- **Junio**: Evaluación semestral
- **Septiembre**: Ajustes presupuestarios
- **Diciembre**: Preparación para año siguiente

---

## Preguntas Frecuentes

**¿Por qué aparece un error con los diezmos?**
> Revisa que la suma de los aportantes coincida con el total de diezmos. El sistema no permite enviar el informe si existe diferencia.

**¿Puedo enviar el informe sin comprobante de depósito?**
> Sí, pero quedará `pendiente_admin`. Cuando tengas el comprobante, edita el informe o agrega la nota correspondiente.

**¿Qué pasa si el pastor entrega cifras en papel?**
> El tesorero nacional debe cargarlas con `Informe Manual`, registrar la fuente (`paper`, `whatsapp`, etc.) y mantener las fotos para respaldo.

**¿Cómo detecto diferencias en los fondos?**
> Usa la pestaña `Conciliación`. Si un fondo aparece en rojo, revisa el libro diario del mismo día o busca transacciones manuales pendientes.

**¿Se puede editar un informe aprobado?**
> Solo la administración nacional puede revertir un informe aprobado. Solicita la reapertura indicando el motivo.

---

## Glosario de Términos

### 📖 Términos Técnicos y Financieros

**Fondo Nacional**: 10% de diezmos y ofrendas que se envía a la administración nacional de IPU Paraguay para gastos administrativos, misiones y proyectos nacionales.

**RUC**: Registro Único del Contribuyente, número de identificación fiscal requerido para facturación legal en Paraguay.

**Honorarios Pastorales**: Pago mensual al pastor de la iglesia local, debe estar respaldado por factura legal con RUC.

**Departamentos**: Organizaciones internas de la iglesia (Caballeros, Damas, Jóvenes, Niños) que realizan actividades y aportes específicos.

**Anexos**: Obras o ministerios adicionales relacionados con la iglesia principal (extensiones, células, puntos de predicación).

**Bautismo en Agua**: Sacramento cristiano de inmersión en agua como símbolo de conversión.

**Bautismo del Espíritu Santo**: Experiencia espiritual evidenciada por hablar en lenguas según la doctrina pentecostal.

**Personería Jurídica**: Reconocimiento legal del estado paraguayo que permite a la iglesia funcionar como entidad legal.

**Guaraní (₲)**: Moneda oficial de Paraguay. El sistema maneja automáticamente la conversión a dólares cuando es necesario.

---

## Actualizaciones del Sistema

### 🔄 Historial de Versiones

**Versión 3.0.1 (Septiembre 2025)**
- ✅ Registro manual de informes con trazabilidad (`submission_source`, `manual_report_source`, `entered_by`).
- ✅ Centro de control en Libro Mensual (procesar informes, transacciones externas, conciliación).
- ✅ Ajustes de saldos 31/12/2024 para igualar Excel oficial.
- ✅ Validaciones de aportantes sincronizadas entre portal pastoral y tesorería.

**Versión 3.0.0 (Septiembre 2025)**
- Migración completa a Next.js 15 + Supabase.
- Nuevo sistema de roles y autenticación Google.
- Dashboard renovado y API consolidada.

**Versión 2.0.0 (Diciembre 2024)**
- Consolidación de 25 a 10 funciones serverless.
- Mejora de rendimiento (27% más rápido).
- Nueva interfaz de usuario (v2) y optimizaciones móviles.

**Próximas Actualizaciones (Q4 2025)**
- 📱 App móvil nativa (modo offline treasurer).
- 🔔 Notificaciones push.
- 📊 Dashboard con gráficos avanzados.
- 🏦 Integración bancaria automatizada.
- 🤖 Asistente inteligente para revisiones.

### 📢 Mantenerse Informado
- **Email**: Notificaciones automáticas de actualizaciones
- **Sistema**: Mensajes in-app sobre nuevas funciones
- **Capacitación**: Entrenamientos cuando hay cambios importantes

---

**© 2025 Iglesia Pentecostal Unida del Paraguay**
*Sistema de Tesorería Nacional - Guía de Usuario v3.0.1*

*Para más información y soporte, contactar: administracion@ipupy.org.py*