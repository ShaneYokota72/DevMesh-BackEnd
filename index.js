/* basic imports */
const express = require('express');
const app = express();
/* mongodb related imports */
const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');

/* donteng import for .env file */
const dotenv = require('dotenv');
dotenv.config();
/* Cors imports (for cross origin request)*/
const cors = require('cors');
/* Cron import (2 hour server side check) */
const cron = require('node-cron');
/* brypt import for enctypting passwords */
const bcrypt = require('bcrypt');
const salt = bcrypt.genSaltSync(10);
/* JWT import for authentication */
const jwt = require('jsonwebtoken');
/* Cookie parser import for JWT Token cookie */
const cookieParser = require('cookie-parser');
/* https/fs import for SSL cert/key */
const https = require('https');
const fs = require('fs-extra')
const key = fs.readFileSync('private.key');
const cert = fs.readFileSync('certificate.crt');
const cred = {
    key,
    cert,
}

const simpleGit = require('simple-git');
simpleGit().clean(simpleGit.CleanOptions.FORCE);

async function gitclone(repoPath){
    const git = simpleGit();
    try{
        const ans = await git.clone(repoPath)
        const foldername = repoPath.split("/").pop()
        const folderObject = await getFolderObject(foldername)
        await deleteRepositoryFolder(foldername)
        return folderObject
    } catch (err){
        console.log("error ", err)
    }
}
// const code = gitclone("https://github.com/rtyley/small-test-repo")
// const code = gitclone("https://github.com/ShaneYokota72/TicTacToe-game")

async function getFolderObject(folderPath) {
    const folderObject = {};
    const files = await fs.readdir(folderPath);
  
    for (const file of files) {
      const filePath = `${folderPath}/${file}`;
      const fileStats = await fs.stat(filePath);
      // make a list of files to ignore and make it cleaner
      if(file === ".git"){
        continue;
      } else if(file === "node_modules"){
        continue;
      } else if(file === ".DS_Store"){
        continue;
      }
      if (fileStats.isDirectory()) {
        const subfolderData = await getFolderObject(filePath);
        folderObject[file] = subfolderData;
      } else if (fileStats.isFile()) {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        folderObject[file] = fileContent;
      }
    }
  
    return folderObject;
  }
  async function deleteRepositoryFolder(repoPath) {
    await fs.remove(repoPath);
  }

/* Socket.io related imports */
/* * * * UNCOMMENT FOR AWS * * * * * */
// const server = https.createServer(cred,app);
/* * * * * * * * * * * * * * * * * * */

/* * * * UNCOMMENT FOR LOCAL * * * * * */
const http = require('http');
const server = http.createServer(app);
/* * * * * * * * * * * * * * * * * * */
const { Server } = require('socket.io');
const port = process.env.SOCKETIO_PORT || 8000
const socketiopath = process.env.SOCKETIO_PATH || ''
app.set('port', port);


app.use(cors({origin: true, credentials: true}));
app.use(express.json());
app.use(cookieParser());

const io = new Server(server, {
    path: socketiopath,
    cors:{
        origin: '*',
    }
});

io.on('connection', socket => {
    // console.log('🔥: A user connected')
    socket.on('join-room', (roomid, name) => { 
        socket.join(roomid);
        socket.to(roomid).emit('user-connected', name);
    })
    socket.on('send-changes', (delta, roomid) => {
        socket.to(roomid).emit('receive-changes', delta);
    })
    socket.on('send-message', (msg, roomid) => {
        // console.log("msg", msg)
        socket.to(roomid).emit('receive-message', msg);
    })
    socket.on('disconnect', () => {
        // console.log('🔥: A user disconnected')
    });
})

// app.get('/.well-known/pki-validation/AC2C6EB4A428EFD0724F4933397F8D1D.txt', (req,res)=>{
//     res.sendFile('/home/ec2-user/DevMesh-backend/AC2C6EB4A428EFD0724F4933397F8D1D.txt')
// })

app.get('/api', (req, res)=>{
    res.send("hi this is root of api 😎")
})

app.get('/api/auth/status', async (req,res) => {
    const { token } = req.cookies;
    if(token === undefined){
        res.status(401).json({message: "not-signed-in"});
        return;
    } else {
        jwt.verify(token, process.env.JWT_PRIVATE_KEY, async function(err, decoded) {
            // console.log(decoded);
            if(err){
                res.status(401).json({message: "not-signed-in"});
                return;
            }
            const userDoc = await User.findOne({username: decoded.username});
            res.status(200).json(userDoc);
        })
    }
})

app.post('/api/signup', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {username, password, displayname} = req.body;
    try {
        const hashedpw = bcrypt.hashSync(password, salt);
        const newUser = await User.create({
            username: username,
            password: hashedpw,
            displayname: displayname,
        });
        res.json(newUser);
    } catch (error) {
        res.status(400).json({error_message: error});
    }
})

app.post('/api/login', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {username, password} = req.body;
    try {
        // const userDoc = await User.findOne({username: username});
        const userDoc = await User.findOne({username: username});
        if(userDoc === null){
            res.status(400).json('User Does not Exist')
            return;
        }
        const pwcompare = bcrypt.compareSync(password, userDoc.password);
        if(pwcompare){
            jwt.sign({ username:username, id:userDoc._id }, process.env.JWT_PRIVATE_KEY, {}, function(err, token) {
                if(err){
                    res.status(500).json({error_message: err});
                }
                let expirationDate = new Date();
                expirationDate.setTime(expirationDate.getTime() + (15 * 60 * 1000));
                // res.cookie('token', token, { expires: expirationDate }).json(userDoc);
                res.cookie('token', token, { httpOnly: true, expires: expirationDate, sameSite: 'none', secure: true}).json(userDoc);
            });
        } else {
            res.status(400).json('Wrong Credentials');
        }
    } catch (error) {
        res.status(500).send(error);
    }
})  

app.post('/api/logout', async (req,res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
    }).json({message: 'Logged Out'});
})

app.post('/api/createroom', async (req, res)=>{
    const {creater, creatername, ispublic, tags, desc} = req.body;
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    try {
        const newRoom = await Room.create({
            creater: creater,
            creatername: creatername,
            public: ispublic,
            tag: tags,
            desc: desc,
            content: '',
        })
        res.json(newRoom);
    } catch (error) {
        res.status(500).json({error_message: error});
    }
})

app.post('/api/loadlobby', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {myid} = req.body;
    try {
        const allrooms = await Room.find({public:true, creater:{$ne:myid}}).sort({createdAt:-1}).limit(6);
        res.json(allrooms);
    } catch (error) {
        res.status(500).json({error_message: error});
    }
})

app.post('/api/confirmroom', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {roomid} = req.body;
    try {
        const room = await Room.findById(roomid);
        if(room !== null || room !== undefined){
            res.status(200).json(room);
        } else {
            res.status(404).json({message: "Room not found"});
        }
    } catch (error) {
        res.status(500).json({error_message: error});
    }
})

app.post('/api/search', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {keyword} = req.body||{};
    const searchresult = await Room.aggregate().
        search({            
            index: 'searchresult',
            text: {
                query: keyword,
                path: ['creater', 'tag', 'desc']
            }
        })
        .match({ public: true });
    res.json(searchresult);
})

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

app.get('/api/room/:id', async (req, res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    try {
      const room = await Room.findById(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json({content:room.content, creater:room.creater});
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/delroom/:id', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const deleteroom = await Room.deleteOne({ _id: req.params.id});
    if(deleteroom.deletedCount === 0){
        res.status(400).json({message: "Room not able to delete"});
    } else if (deleteroom.deletedCount === 1){
        res.status(200).json({message: "Room deleted"});
    }
})

app.post('/api/room', async (req, res)=>{
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    const {name, tag, desc, ispublic} = req.body;
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

cron.schedule('* */2 * * *', async () => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING)
    console.log('running a task every two hours');
    const twodaysago = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const deleteoldrooms = await Room.deleteMany({ updatedAt: { $lt: twodaysago }});
});

// socketio port
server.listen(port);

// api port
/* * * * * * * * UNCOMMENT FOR AWS DEVELOPMENT * * * * * * * * */
// const httpsServer = https.createServer(cred, app);
// httpsServer.listen(process.env.API_PORT);
/* * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * UNCOMMENT FOR Local DEVELOPMENT * * * * * * * * */
app.listen(process.env.API_PORT);
/* * * * * * * * * * * * * * * * * * * * * * * * * * * */

module.exports = app;