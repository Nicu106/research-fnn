"""Local server for Neural Face: static files with caching disabled.

Uses only the Python standard library (no installs). Disabling the cache makes sure
the browser always loads the latest version of every JS module after an update.
"""

import http.server
import socket
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".glb": "model/gltf-binary",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    # Dual-stack: browsers resolve "localhost" to ::1 first, so listen on IPv6 and IPv4.
    address_family = socket.AF_INET6
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


if __name__ == "__main__":
    with Server(("::", PORT), NoCacheHandler) as httpd:
        print(f"Neural Face: http://localhost:{PORT}  (Ctrl+C pentru oprire)")
        httpd.serve_forever()
