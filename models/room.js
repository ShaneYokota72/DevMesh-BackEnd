const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const RoomSchema = new Schema({
    creater: {type:Schema.Types.ObjectId, ref:'User'},
    creatername: String,
    public: Boolean,
    tag: String,
    desc: String,
    content: Object,
}, {
    timestamps: true,  
});

const RoomModel = model('Room', RoomSchema);
module.exports = RoomModel;