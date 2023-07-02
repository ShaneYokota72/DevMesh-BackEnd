const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const RoomSchema = new Schema({
    creater: String,
    public: Boolean,
    tag: String,
    desc: String,
    content: String,
}, {
    timestamps: true,  
});

const RoomModel = model('Room', RoomSchema);
module.exports = RoomModel;