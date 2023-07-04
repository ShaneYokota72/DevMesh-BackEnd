const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const UserSchema = new Schema({
    username: String,
    password: String,
});

const UserModel = model('User', UserSchema);
module.exports = UserModel;