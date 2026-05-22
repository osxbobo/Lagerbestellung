#!/usr/bin/env python3
import http.server, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 3344
handler = http.server.SimpleHTTPRequestHandler
with http.server.HTTPServer(('', port), handler) as httpd:
    print(f'Serving on http://localhost:{port}')
    httpd.serve_forever()
