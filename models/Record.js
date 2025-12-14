const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    makhdoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Makhdoom' },
    servantEmail: String, // عشان نعرف مين سجل بسرعة
    servantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Servant' }, // جديد: ربط دقيق بالخادم
    type: String,         // 'injil', 'mazmour', 'bonus'
    book: String,
    chapter: Number,
    verses: String,
    description: String,  // جديد: وصف لنشاط البونص
    pointsEarned: Number,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Record', recordSchema);