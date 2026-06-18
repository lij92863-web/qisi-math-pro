const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8080);
const host = '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
    if (pathname === '/') pathname = '/main.html';

    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    res.writeHead(500);
    res.end(error && error.message ? error.message : String(error));
  }
}).listen(port, host, () => {
  console.log(`Qisi static server: http://${host}:${port}/main.html`);
});
