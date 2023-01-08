const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const { start, initHyperswarm } = require('./peer');
const b4a = require('b4a');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
let port = 8000;
const conns = [];
const socketsStatus = {};

const SOCKET_ON = {
  chat: 'chat',
  voice: 'voice',
};

app.get('/', (req, res) => {
  console.log(conns.length);
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  const socketId = socket.id;
  socketsStatus[socket.id] = {};

  socket.on(SOCKET_ON.chat, async (msg) => {
    if (msg === 'init') {
      io.emit(SOCKET_ON.chat, 'initing host server');
      const swarm = initHyperswarm();
      swarm.on('connection', (conn) => {
        // console.log(socket)
        const name = b4a.toString(conn.remotePublicKey, 'hex');
        console.log('* got a connection from:', name, '*');
        conns.push(conn);
        conn.once('close', () => conns.splice(conns.indexOf(conn), 1));
        conn.on('data', (data) => {
          const stringData = b4a.toString(data, 'utf-8');
          if (stringData.includes('data:audio/ogg;base64')) {
            io.emit(SOCKET_ON.voice, stringData);
          } else {
            console.log(`${name}: ${data}`);
            io.emit(SOCKET_ON.chat, `${name}: ${stringData}`);
          }
        });
      });
      const topic = Buffer.alloc(32).fill('ton test');
      const discovery = swarm.join(topic, { client: true, server: true });

      // The flushed promise will resolve when the topic has been fully announced to the DHT
      discovery.flushed().then(() => {
        console.log('joined topic as host:', b4a.toString(topic, 'hex'));
        io.emit(
          SOCKET_ON.chat,
          `hyperswarm inited your public key is ${b4a.toString(topic, 'hex')}`
        );
      });
      process.stdin.on('data', (d) => {
        for (const conn of conns) {
          conn.write(d);
        }
      });
    } else if (msg.startsWith('join')) {
      // const publicKey = msg.slice(5)
      const publicKey =
        '746f6e2074657374746f6e2074657374746f6e2074657374746f6e2074657374';

      io.emit(SOCKET_ON.chat, `joining to ${publicKey}`);
      const swarm = initHyperswarm();
      swarm.on('connection', (conn) => {
        // console.log(socket)
        const name = b4a.toString(conn.remotePublicKey, 'hex');
        console.log('* got a connection from:', name, '*');
        conns.push(conn);
        conn.once('close', () => conns.splice(conns.indexOf(conn), 1));
        conn.on('data', (data) => {
          const stringData = b4a.toString(data, 'utf-8');
          if (stringData.includes('data:audio/ogg;base64')) {
            io.emit(SOCKET_ON.voice, stringData);
          } else {
            console.log(`${name}: ${data}`);
            io.emit(SOCKET_ON.chat, `${name}: ${stringData}`);
          }
        });
      });
      const topic = b4a.from(publicKey, 'hex');
      const discovery = swarm.join(topic, { client: true, server: true });
      discovery.flushed().then(() => {
        console.log('joined topic as client:', b4a.toString(topic, 'hex'));
        io.emit(
          SOCKET_ON.chat,
          `hyperswarm joined with public key ${b4a.toString(topic, 'hex')}`
        );
      });
      process.stdin.on('data', (d) => {
        for (const conn of conns) {
          conn.write(d);
        }
      });
    } else if (msg === 'check conns') {
      io.emit(SOCKET_ON.chat, `conns length is ${conns.length}`);
    } else {
      for (const conn of conns) {
        conn.write(msg);
      }
      io.emit(SOCKET_ON.chat, msg);
    }
  });

  socket.on(SOCKET_ON.voice, async (data) => {
    let newData = data.split(';');
    newData[0] = 'data:audio/ogg;';
    newData = newData[0] + newData[1];

    for (const id in socketsStatus) {
      if (!socketsStatus[id].mute && socketsStatus[id].online) {
        for (const conn of conns) {
          conn.write(newData);
        }
        // socket.broadcast.to(id).emit("send", newData);
      }
    }
  });

  socket.on('userInformation', function (data) {
    socketsStatus[socketId] = data;
    io.emit(SOCKET_ON.chat, JSON.stringify(socketsStatus[socketId]));
    io.sockets.emit('usersUpdate', socketsStatus);
  });

  socket.on('disconnect', function () {
    delete socketsStatus[socketId];
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

let isError = false;
server
  .on('error', (err) => {
    isError = true;
    console.error(`Error starting server: ${err.message}`);
    port = port + 1;
    server.listen(port, (err) => {
      console.log(`Server started successfully on new port ${port}`);
    });
  })
  .listen(port, () => {
    if (!isError) {
      console.log(`Server started successfully on port ${port}`);
    }
  });
