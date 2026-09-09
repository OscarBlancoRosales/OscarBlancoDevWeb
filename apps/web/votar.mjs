import WebSocket from 'ws';
const [sala, ...pares] = process.argv.slice(2);
for (const par of pares) {
  const [pase, valor, texto] = par.split('|');
  const ws = new WebSocket(`ws://127.0.0.1:3000/ws?sala=${sala}`);
  ws.on('open', () => {
    ws.send(JSON.stringify({ tipo: 'hola', pase }));
    setTimeout(() => ws.send(JSON.stringify({ tipo: 'accion', accion: { tipo: 'votar', voto: { tipo: 'numero', valor: Number(valor) } } })), 800);
    if (texto) setTimeout(() => ws.send(JSON.stringify({ tipo: 'chat', texto })), 1600);
  });
}
setTimeout(() => process.exit(0), 3500);
