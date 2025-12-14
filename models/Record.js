// models/Record.js
const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    makhdoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Makhdoom' },
    servantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servant' }, // عشان نعرف مين الخادم
    servantEmail: String,
    type: String,         // 'injil', 'mazmour', 'bonus'
    book: String,
    chapter: Number,
    verses: String,
    description: String,  // (جديد) وصف لسبب البونص أو الخصم
    pointsEarned: Number, // بيقبل موجب وسالب
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Record', recordSchema);