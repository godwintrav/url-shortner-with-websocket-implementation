const { io } = require('socket.io-client');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const clientId = uuidv4();
const socket = io('http://localhost:3000'); //We use a Socket.IO protocol

socket.on('connect', async () => {
  console.log('Connected to server via Socket.IO:', socket.id);
  socket.emit('register', { clientId });

  try {
    console.log('URL about to be sent to server');
    await axios.post('http://localhost:3000/url', { url: 'classcalc.com', clientId });
  } catch (err) {
    console.error('POST error:', err.message);
  }
});

socket.on('shortened', (data) => {
  console.log('Shortened URL received:', data.shortenedURL);
  socket.emit('ack', { shortenedURL: data.shortenedURL });
  console.log('ACK sent.');
});

socket.on('registered', (data) => {
    console.log("REGISTERED EVENT",data);
})

socket.on('connect_error', (err) => {
  console.error('Socket.IO connection error:', err);
});
