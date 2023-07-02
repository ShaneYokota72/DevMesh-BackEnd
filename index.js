const express = require('express');
const app = express();
const mongoose = require('mongoose');
const Room = require('./models/room');
const cors = require('cors');
const cron = require('node-cron');
const dotenv = require('dotenv');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
dotenv.config();
const port = process.env.SOCKETIO_PORT || 8080
app.set('port', port);
const socketiopath = process.env.SOCKETIO_PATH || ''

app.use(cors());
app.use(express.json())

const io = new Server(server, {
    path: socketiopath,
    cors:{
        origin: '*',
    }
});

io.on('connection', socket => {
    // console.log('🔥: A user connected')
    socket.on('join-room', (roomid) => { 
        socket.join(roomid);
    })
    socket.on('send-changes', (delta, roomid) => {
        socket.to(roomid).emit('receive-changes', delta);
    })
    socket.on('send-message', (msg, roomid) => {
        console.log("msg", msg)
        socket.to(roomid).emit('receive-message', msg);
    })
    socket.on('disconnect', () => {
        // console.log('🔥: A user disconnected');
    });
})

app.get('/api', (req, res)=>{
    res.send("hi this is root of api 😎")
})

app.post('/api/room', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const {name, tag, desc, ispublic} = req.body||{};
    const newRoom = await Room.create({
        creater: name,
        public: ispublic,
        tag: tag,
        desc: desc,
        content: '',
    });
    res.json({roomid: newRoom._id});
})

app.get('/api/roomopen/:id', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const datalimit = req.params.id;
    const rooms = await Room.find({public:true}).sort({createdAt:-1}).limit(datalimit);
    res.json(rooms);
})

app.get('/api/room/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    try {
      const room = await Room.findById(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json(room.content);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

app.put('/api/save/:id', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const {roomid, content} = req.body || {};
    const roomdoc = await Room.findById(roomid);
    if(roomdoc === null){
        res.status(404).json({message: "Room not found"});
        return;
    }
    roomdoc.content = content;
    await roomdoc.save();
    res.json(roomdoc);
})

app.post('/api/search', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const {keyword} = req.body||{};
    const searchresult = await Room.aggregate().
        search({            
            index: 'searchresult',
            text: {
                query: keyword,
                path: ['creater', 'tag', 'desc']
            }
        });
    res.json(searchresult);
})

app.post('/api/deleteroom/:id', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const {roomid, username} = req.body || {};
    const deleteroom = await Room.deleteOne({ _id: roomid, creater:username });
    if(deleteroom.deletedCount === 0){
        res.status(200).json({message: "Room not able to delete"});
    } else if (deleteroom.deletedCount === 1){
        res.status(200).json({message: "Room deleted"});
    }
})

cron.schedule('* * 2 * * *', async () => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    console.log('running a task every two hours');
    const onedayago = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleteoldrooms = await Room.deleteMany({ updatedAt: { $lt: onedayago }});
});

server.listen(port, () => {
    // console.log(`Example app listening at http://localhost:${port}`)
})

app.listen(process.env.API_PORT, () => {
    // console.log(`Server running on port ${process.env.API_PORT}`)
    // console.log(`mongoose connection url: ${process.env.MONGODB_CONNECTION_STRING}`)
})

module.exports = app;