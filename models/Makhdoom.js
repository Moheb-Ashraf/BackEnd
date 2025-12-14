const mongoose = require('mongoose');

const makhdoomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: String,
    totalPoints: { type: Number, default: 0 }, // الرصيد
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Makhdoom', makhdoomSchema);