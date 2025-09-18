# IPU PY - Sistema Simplificado de Tesorería

<p align="left">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <a href="https://github.com/anthonybir/ipupy_tesoreria/issues"><img alt="Issues" src="https://img.shields.io/github/issues/anthonybir/ipupy_tesoreria"></a>
  <a href="https://github.com/anthonybir/ipupy_tesoreria/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/anthonybir/ipupy_tesoreria?style=social"></a>
  <img alt="Platform" src="https://img.shields.io/badge/Platform-Vercel-black?logo=vercel"/>
  <img alt="Tech" src="https://img.shields.io/badge/Stack-HTML%2FJS%20%2B%20Python-ffb000"/>
</p>


> Consulta el documento [`AGENTS.md`](AGENTS.md) para lineamientos de contribución y desarrollo.

## 🚀 Versión Ultra-Simplificada

Ya no más Next.js ni complejidades. Ahora es **una sola página HTML** que funciona directamente en el navegador.

## ✨ Características

### Para el Tesorero:
- **Dashboard**: Ve todo de un vistazo - iglesias activas, recaudación mensual, fondo nacional
- **Registro rápido**: Entrada manual o por foto de informes
- **Cálculo automático**: El 10% del fondo nacional se calcula solo
- **Exportación**: Descarga todo a Excel con un clic
- **Sin instalación**: Abre el archivo HTML y listo

### Para las Iglesias:
- **App móvil simple**: Una página web optimizada para celulares
- **Entrada rápida**: Botones de montos frecuentes
- **Foto del comprobante**: Toma foto directo desde el celular
- **Confirmación instantánea**: Feedback inmediato al enviar

## 📁 Estructura Super Simple

```
ipupy_treasurer/
├── index.html     # Sistema completo del tesorero
├── mobile.html    # App para iglesias (celulares)
└── server.py      # Servidor opcional (Python)
```

## 🏃 Cómo Usar - Opción 1: Sin Servidor (Más Simple)

1. **Abre el archivo** `index.html` en Chrome o Firefox
2. **Listo!** Ya puedes:
   - Registrar iglesias
   - Ingresar informes mensuales
   - Ver dashboard con totales
   - Exportar a Excel

Los datos se guardan en el navegador (localStorage).

## 🖥️ Cómo Usar - Opción 2: Con Servidor (Para múltiples usuarios)

```bash
# En la terminal:
cd ipupy_treasurer
python3 server.py

# Se abre automáticamente en http://localhost:8000
```

## 📱 Para las Iglesias

Comparte el link `http://tuservidor:8000/mobile.html` con cada iglesia.
Ellos pueden:
1. Abrir en el celular
2. Llenar los montos (con botones rápidos)
3. Tomar foto del comprobante
4. Enviar

## 💡 Ventajas de Esta Versión

- **Sin dependencias**: No necesita Node.js, npm, ni nada
- **Un solo archivo**: Todo el sistema en `index.html`
- **Funciona offline**: Los datos se guardan localmente
- **Exporta a Excel**: Compatible con Google Sheets
- **Mobile-first**: La versión móvil es perfecta para celulares
- **Gratis para siempre**: Sin costos de hosting ni mantenimiento

## 🔧 Personalización Fácil

Todo está en HTML puro. Para cambiar algo:
1. Abre `index.html` en cualquier editor de texto
2. Busca la sección que quieres cambiar
3. Modifica y guarda
4. Recarga la página

## 📊 Flujo de Trabajo Simplificado

```
Mes nuevo → Iglesias reportan → Tesorero verifica → Exporta a Excel → Listo
```

Sin complicaciones. Sin bugs. Sin mantenimiento.

## 🎯 Datos que Trackea

- **Iglesias**: Nombre, Ciudad, Pastor, Teléfono
- **Informes Mensuales**:
  - Total Diezmos
  - Total Ofrendas
  - 10% Fondo Nacional (calculado automático)
  - Número de comprobante bancario
  - Fecha de depósito

## 🚨 Backup de Datos

Los datos se guardan en el navegador. Para hacer backup:
1. Click en "Exportar a Excel" cada mes
2. Guarda el archivo en Google Drive
3. Listo, tienes respaldo

---

**Creado con ❤️ para simplificar la vida del tesorero IPU PY**
