const mongoose = require('mongoose');

const servantSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'servant' } // جديد: إما 'servant' أو 'admin'
});

module.exports = mongoose.model('Servant', servantSchema);