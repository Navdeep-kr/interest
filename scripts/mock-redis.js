#!/usr/bin/env node

/**
 * Lightweight In-Memory Mock Redis Server for Local Development & Testing
 * Emulates RESP protocol sufficient for ioredis & BullMQ startup.
 */

const net = require('net');

const memoryStore = new Map();

function encodeRespString(str) {
  return `+${str}\r\n`;
}

function encodeRespBulk(str) {
  if (str === null || str === undefined) return '$-1\r\n';
  const buf = Buffer.from(str, 'utf-8');
  return `$${buf.length}\r\n${str}\r\n`;
}

function encodeRespArray(arr) {
  if (!arr) return '*-1\r\n';
  let out = `*${arr.length}\r\n`;
  for (const item of arr) {
    if (item === null || item === undefined) {
      out += '$-1\r\n';
    } else if (Array.isArray(item)) {
      out += encodeRespArray(item);
    } else {
      out += encodeRespBulk(String(item));
    }
  }
  return out;
}

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const raw = data.toString('utf-8');
    const lines = raw.split('\r\n').filter(Boolean);

    // Extract command words from RESP or inline format
    const words = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('*') && !lines[i].startsWith('$')) {
        words.push(lines[i]);
      }
    }

    const cmd = (words[0] || '').toUpperCase();

    if (cmd === 'PING') {
      socket.write('+PONG\r\n');
    } else if (cmd === 'INFO') {
      const info = 'redis_version:7.2.4\r\nrole:master\r\nconnected_clients:1\r\nused_memory:1048576\r\n';
      socket.write(encodeRespBulk(info));
    } else if (cmd === 'COMMAND') {
      socket.write('*0\r\n');
    } else if (cmd === 'CLIENT') {
      socket.write('+OK\r\n');
    } else if (cmd === 'SELECT') {
      socket.write('+OK\r\n');
    } else if (cmd === 'CONFIG') {
      socket.write('*0\r\n');
    } else if (cmd === 'SCRIPT') {
      socket.write(encodeRespString('OK'));
    } else if (cmd === 'EVAL' || cmd === 'EVALSHA') {
      socket.write('*0\r\n');
    } else if (cmd === 'SET') {
      if (words[1] && words[2]) {
        memoryStore.set(words[1], words[2]);
      }
      socket.write('+OK\r\n');
    } else if (cmd === 'GET') {
      const val = memoryStore.get(words[1]);
      socket.write(encodeRespBulk(val));
    } else if (cmd === 'DEL') {
      const existed = memoryStore.delete(words[1]);
      socket.write(`:${existed ? 1 : 0}\r\n`);
    } else if (cmd === 'HGETALL') {
      socket.write('*0\r\n');
    } else if (cmd === 'SMEMBERS') {
      socket.write('*0\r\n');
    } else if (cmd === 'QUIT') {
      socket.write('+OK\r\n');
      socket.end();
    } else {
      socket.write('+OK\r\n');
    }
  });

  socket.on('error', () => {});
});

const PORT = 6379;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[MockRedis] In-Memory Redis server listening on 127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
