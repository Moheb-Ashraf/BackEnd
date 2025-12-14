const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    makhdoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Makhdoom' }, // بنربط بالآيدي
    date: { type: Date, default: Date.now },
    servantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servant' } // مين الخادم اللي خد الغياب
});

module.exports = mongoose.model('Attendance', attendanceSchema);

