#!/bin/bash

echo "
╔════════════════════════════════════════════╗
║     IPU PY - Sistema de Tesorería         ║
║           Versión Simplificada             ║
╚════════════════════════════════════════════╝

Seleccione una opción:

1) Abrir versión local (sin servidor)
2) Iniciar servidor web
3) Ver instrucciones

"

read -p "Opción (1-3): " choice

case $choice in
    1)
        echo "Abriendo sistema en el navegador..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open index.html
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open index.html
        else
            echo "Por favor, abra index.html manualmente en su navegador"
        fi
        ;;
    2)
        echo "Iniciando servidor web..."
        python3 server.py
        ;;
    3)
        echo "
INSTRUCCIONES RÁPIDAS:
======================

OPCIÓN 1 - Sin servidor (Recomendado para uso personal):
- Simplemente abra el archivo 'index.html' en su navegador
- Todo funciona localmente, sin necesidad de internet

OPCIÓN 2 - Con servidor (Para múltiples usuarios):
- Ejecute: python3 server.py
- Comparta el link con las iglesias

PARA LAS IGLESIAS:
- Envíeles el archivo 'mobile.html' 
- O el link: http://suservidor:8000/mobile.html

¡Eso es todo! Sin complicaciones.
        "
        ;;
    *)
        echo "Opción no válida"
        ;;
esac
