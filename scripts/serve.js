require('./_root');

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve('dist');
const port = Number(process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  const target = path.join(root, file);
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`http://localhost:${port}`);
});
