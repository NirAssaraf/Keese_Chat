const { ApolloServer, gql } = require('apollo-server');
const path = require('path');
const admin = require('firebase-admin');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');

var serviceAccount = require("./permissions.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://keese-realtimechat..firebaseio.com"
});
const db = admin.firestore();
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
  getRoomList
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));
const botName = 'ChatCord Bot';

// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    responses = [];
    var firstThreeRes = db.collection("messages")
    .where('room', '==', room)
    .orderBy('time', 'desc');
     firstThreeRes.onSnapshot(snapshot => {
       snapshot.docChanges().forEach(function(change) {
           var message = change.doc.data();
           socket.emit('message',formatMessage(message.userName, message.content,message.time.toDate()));
       });
     });
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    socket.broadcast
      .to(user.room)
      .emit(
        'message',
   //     formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    let date_ob = new Date();
    const user = getCurrentUser(socket.id);
    db.collection("messages").add({
    userName:user.username,
    room: user.room,
    time:date_ob,
    content:msg
  })
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
  //      formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const typeDefs = gql`
  type Room {
    name: String
    messages:[Episode!]!
  }

  type Query {
    rooms: [Room]
  }
`;




