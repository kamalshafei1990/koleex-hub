import http.server
import socketserver
import os

port = int(os.environ.get("PORT", 3000))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", port), Handler) as httpd:
    print(f"Serving KOLEEX ERP at http://localhost:{port}")
    httpd.serve_forever()
