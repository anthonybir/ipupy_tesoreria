#!/usr/bin/env python3
"""
IPU PY Treasurer - Simple Server
Servidor minimalista para el sistema de tesorería
"""

import os
import json
import sqlite3
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
from pathlib import Path

class TreasurerHandler(SimpleHTTPRequestHandler):
    """Handler básico para servir la aplicación"""
    
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        return SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        """Maneja uploads de fotos y datos"""
        if self.path == '/api/upload':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Por ahora solo guardamos la imagen
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            uploads_dir = Path("uploads")
            uploads_dir.mkdir(exist_ok=True)
            
            # Guardar archivo
            file_path = uploads_dir / f"informe_{timestamp}.jpg"
            with open(file_path, 'wb') as f:
                f.write(post_data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "success", "file": str(file_path)}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

def setup_database():
    """Crea la base de datos SQLite si no existe"""
    conn = sqlite3.connect('ipupy_treasurer.db')
    cursor = conn.cursor()
    
    # Tabla de iglesias
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS churches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            pastor TEXT NOT NULL,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de informes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            church_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            tithes REAL NOT NULL,
            offerings REAL NOT NULL,
            national_contribution REAL NOT NULL,
            bank_receipt TEXT,
            deposit_date DATE,
            photo_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (church_id) REFERENCES churches (id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✓ Base de datos inicializada")

def run_server(port=8000):
    """Inicia el servidor web"""
    setup_database()
    
    server_address = ('', port)
    httpd = HTTPServer(server_address, TreasurerHandler)
    
    print(f"""
    ╔════════════════════════════════════════╗
    ║   IPU PY - Sistema de Tesorería       ║
    ╠════════════════════════════════════════╣
    ║   Servidor corriendo en:               ║
    ║   http://localhost:{port}              ║
    ║                                        ║
    ║   Presiona Ctrl+C para detener        ║
    ╚════════════════════════════════════════╝
    """)
    
    # Abrir navegador automáticamente
    webbrowser.open(f'http://localhost:{port}')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Servidor detenido")
        httpd.shutdown()

if __name__ == '__main__':
    run_server()
