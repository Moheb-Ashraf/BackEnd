const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    makhdoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Makhdoom' },
    servantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servant' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', attendanceSchema);