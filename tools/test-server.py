"""The test suite's web server: `python3 -m http.server`, minus the noise.

Same handler, same threading server, same directory (the one it is started
in), so the suite sees exactly the files and headers it saw before. The only
change is the log. The stock server writes one line per request, and a
Playwright shard asks for every page, script and image over and over: shard
1's log on 27 Nov was about 45,000 lines of "GET ... 200", and a real failure
had to be found underneath them.

So a request that worked (status below 400) is not logged. A 404, a 500, a
broken request -- anything that might explain a failing test -- is logged
exactly as before.

Usage: python3 tools/test-server.py PORT
"""
import http.server
import sys


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_request(self, code='-', size='-'):
        try:
            status = int(getattr(code, 'value', code))
        except (TypeError, ValueError):
            status = 0  # unknown status: log it rather than guess
        if status == 0 or status >= 400:
            super().log_request(code, size)


if __name__ == '__main__':
    port = int(sys.argv[1])
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), QuietHandler)
    server.serve_forever()
