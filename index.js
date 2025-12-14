require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// استدعاء الموديلز
const Servant = require('./models/Servant');
const Makhdoom = require('./models/Makhdoom');
const Record = require('./models/Record');
const Attendance = require('./models/Attendance');

const app = express();
app.use(express.json());
app.use(cors());

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("✅ DB Connected Successfully"))
    .catch((err) => console.log("❌ DB Error:", err));

// ==========================================
// Middleware (الحارس - للتحقق من التوكن)
// ==========================================
const verifyToken = (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) return res.status(401).send("من فضلك سجل دخول أولاً");

    try {
        const verified = jwt.verify(token, process.env.TOKEN_SECRET || "SECRET_KEY_CHURCH_123");
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).send("توكن غير صحيح");
    }
};

// ==========================================
// 1. قسم الخدام (Auth)
// ==========================================

// تسجيل خادم جديد
app.post('/api/register', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        const newServant = new Servant({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            role: 'servant' // الافتراضي خادم عادي
        });
        await newServant.save();
        res.send("تم تسجيل الخادم بنجاح");
    } catch (error) {
        res.status(500).send("حدث خطأ، ربما الإيميل مسجل مسبقاً");
    }
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const servant = await Servant.findOne({ email: req.body.email });
    if (!servant) return res.status(400).send("الإيميل غير صحيح");

    const validPass = await bcrypt.compare(req.body.password, servant.password);
    if (!validPass) return res.status(400).send("الباسورد غير صحيح");

    // إنشاء التوكن
    const token = jwt.sign({ _id: servant._id, email: servant.email }, process.env.TOKEN_SECRET || "SECRET_KEY_CHURCH_123");
    
    // إرسال البيانات (بما فيها الرتبة role)
    res.json({ 
        token: token, 
        name: servant.name, 
        id: servant._id,
        role: servant.role 
    });
});


// ==========================================
// 2. قسم إدارة المخدومين
// ==========================================

// إضافة مخدوم جديد
app.post('/api/create-makhdoom', verifyToken, async (req, res) => {
    try {
        const newMakhdoom = new Makhdoom({
            name: req.body.name,
            phone: req.body.phone
        });
        await newMakhdoom.save();
        res.send(newMakhdoom);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// جلب كل المخدومين (للقائمة الرئيسية)
app.get('/api/all-makhdoomen', verifyToken, async (req, res) => {
    try {
        const all = await Makhdoom.find();
        res.json(all);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// جلب تفاصيل مخدوم معين + السجل التاريخي
app.get('/api/makhdoom-details/:id', verifyToken, async (req, res) => {
    try {
        const makhdoom = await Makhdoom.findById(req.params.id);
        if (!makhdoom) return res.status(404).send("مخدوم غير موجود");

        const history = await Record.find({ makhdoomId: req.params.id }).sort({ date: -1 });

        res.json({
            info: makhdoom,
            history: history
        });
    } catch (err) {
        res.status(404).send("مخدوم غير موجود");
    }
});

// (جديد) حذف مخدوم نهائياً
app.delete('/api/delete-makhdoom/:id', verifyToken, async (req, res) => {
    try {
        const makhdoomId = req.params.id;

        // 1. حذف كل السجلات المرتبطة بيه (عشان الداتا بيز تنضف)
        await Record.deleteMany({ makhdoomId: makhdoomId });
        await Attendance.deleteMany({ makhdoomId: makhdoomId });

        // 2. حذف المخدوم نفسه
        await Makhdoom.findByIdAndDelete(makhdoomId);

        res.send("تم حذف المخدوم وكل بياناته بنجاح");
    } catch (err) {
        res.status(500).send("حدث خطأ أثناء الحذف");
    }
});


// ==========================================
// 3. قسم العمليات والنقاط
// ==========================================

// تسجيل الحضور (+5 نقط)
app.post('/api/attendance', verifyToken, async (req, res) => {
    const { makhdoomId } = req.body;
    try {
        const newAttendance = new Attendance({
            makhdoomId: makhdoomId,
            servantId: req.user._id
        });
        await newAttendance.save();

        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: 5 } });
        res.send("تم تسجيل الحضور");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// إضافة سجل روحي (إنجيل / مزمور)
app.post('/api/add-record', verifyToken, async (req, res) => {
    const { makhdoomId, category, bookName, chapter, verses, versesCount } = req.body;

    let pointsToAdd = 0;
    let finalBookName = bookName;

    if (category === 'mazmour') {
        finalBookName = 'المزامير';
        pointsToAdd = (versesCount || 0) * 2; 
    } else {
        pointsToAdd = 2; // الإنجيل بـ 2 نقطة
    }

    try {
        const newRecord = new Record({
            makhdoomId,
            servantId: req.user._id,
            servantEmail: req.user.email,
            type: category,
            book: finalBookName,
            chapter,
            verses,
            pointsEarned: pointsToAdd
        });
        await newRecord.save();

        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: pointsToAdd } });
        res.json({ message: "تم التسجيل", pointsAdded: pointsToAdd });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// (جديد) إضافة بونص أو خصم
// الفرونت إند بيبعت الرقم موجب (مكافأة) أو سالب (خصم)
app.post('/api/add-bonus', verifyToken, async (req, res) => {
    const { makhdoomId, points, description } = req.body;

    try {
        const newRecord = new Record({
            makhdoomId,
            servantId: req.user._id,
            servantEmail: req.user.email,
            type: 'bonus', // نوع جديد للسجل
            description: description,
            pointsEarned: points // الرقم هييجي جاهز (+ أو -)
        });
        await newRecord.save();

        // $inc بيزود الرقم، ولو الرقم سالب بينقصه
        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: points } });

        res.json({ message: "تم تعديل النقاط", pointsAdded: points });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// ==========================================
// 4. قسم الأدمن (المشرفين)
// ==========================================
app.get('/api/admin/logs', verifyToken, async (req, res) => {
    try {
        // التحقق من الرتبة
        const requester = await Servant.findById(req.user._id);
        if (requester.role !== 'admin') {
            return res.status(403).send("غير مسموح إلا للمشرفين");
        }

        // جلب كل السجلات مع بيانات الخادم والمخدوم
        const logs = await Record.find()
            .populate('servantId', 'name')
            .populate('makhdoomId', 'name')
            .sort({ date: -1 });

        res.json(logs);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server Running on Port ${PORT}`));