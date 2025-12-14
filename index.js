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
        const verified = jwt.verify(token, "SECRET_KEY_CHURCH_123");
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
        // تشفير الباسورد
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        const newServant = new Servant({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
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
    const token = jwt.sign({ _id: servant._id, email: servant.email }, "SECRET_KEY_CHURCH_123");
    
    // إرسال التوكن واسم الخادم
    res.json({ 
    token: token, 
    name: servant.name, 
    id: servant._id, 
    role: servant.role // بنرجع الرتبة
});
});





// ==========================================
// 2. قسم المخدومين (Data)
// ==========================================

// أ. إضافة مخدوم جديد (إنشاء ملف)
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

// ب. جلب بيانات المخدوم + تاريخه الروحي (ده طلبك الجديد)
app.get('/api/makhdoom-details/:id', verifyToken, async (req, res) => {
    try {
        // 1. نجيب البيانات الأساسية والنقاط
        const makhdoom = await Makhdoom.findById(req.params.id);
        
        // 2. نجيب كل الحاجات اللي سمعها (Records) الخاصة بالـ ID ده
        // .sort({ date: -1 }) عشان يجيب الأحدث الأول
        const history = await Record.find({ makhdoomId: req.params.id }).sort({ date: -1 });

        // 3. نبعت الاتنين مع بعض للفرونت إند
        res.json({
            info: makhdoom,   // الاسم والنقاط
            history: history  // لستة الشواهد والمزامير اللي سمعها
        });
    } catch (err) {
        res.status(404).send("مخدوم غير موجود");
    }
});

// ج. جلب كل المخدومين (عشان القائمة الرئيسية)
app.get('/api/all-makhdoomen', verifyToken, async (req, res) => {
    try {
        const all = await Makhdoom.find();
        res.json(all);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// ==========================================
// 3. قسم العمليات (تسجيل وحضور)
// ==========================================

// أ. تسجيل الحضور (+5 نقط)
app.post('/api/attendance', verifyToken, async (req, res) => {
    const { makhdoomId } = req.body; // لازم الفرونت يبعت الآيدي

    try {
        // تسجيل واقعة الحضور
        const newAttendance = new Attendance({
            makhdoomId: makhdoomId,
            servantId: req.user._id
        });
        await newAttendance.save();

        // زيادة النقاط
        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: 5 } });

        res.send("تم تسجيل الحضور وإضافة 5 نقاط");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/add-bonus', verifyToken, async (req, res) => {
    const { makhdoomId, points, description } = req.body;

    try {
        const newRecord = new Record({
            makhdoomId,
            servantId: req.user._id, // من التوكن
            servantEmail: req.user.email,
            type: 'bonus',
            description: description, // مثلا: "حضور قداس"
            pointsEarned: points
        });
        await newRecord.save();

        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: points } });

        res.json({ message: "تم إضافة البونص", pointsAdded: points });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/admin/logs', verifyToken, async (req, res) => {
    try {
        // نتأكد إن اللي بيطلب ده أدمن
        const requester = await Servant.findById(req.user._id);
        if (requester.role !== 'admin') {
            return res.status(403).send("غير مسموح إلا للمشرفين");
        }

        // هات كل السجلات واعمل populate عشان تظهر اسماء الخدام والمخدومين
        const logs = await Record.find()
            .populate('servantId', 'name') // هات اسم الخادم
            .populate('makhdoomId', 'name') // هات اسم المخدوم
            .sort({ date: -1 }); // الأحدث أولاً

        res.json(logs);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// ب. تسجيل متابعة روحية (مزمور أو إنجيل) وحساب النقاط
app.post('/api/add-record', verifyToken, async (req, res) => {
    const { makhdoomId, category, bookName, chapter, verses, versesCount } = req.body;

    let pointsToAdd = 0;
    let finalBookName = bookName;

    // --- حساب النقاط ---
    if (category === 'mazmour') {
        finalBookName = 'المزامير';
        // المعادلة: عدد آيات المزمور × 2
        // لو مبعتش عدد الآيات هنحسبها صفر
        pointsToAdd = (versesCount || 0) * 2; 
    } else {
        // إنجيل: 2 نقطة ثابتة
        pointsToAdd = 2;
    }

    try {
        // 1. حفظ السجل
        const newRecord = new Record({
            makhdoomId: makhdoomId, // بنربط بالآيدي
            servantEmail: req.user.email,
            type: category,
            book: finalBookName,
            chapter,
            verses,
            pointsEarned: pointsToAdd // بنسجل خد كام نقطة في المرة دي
        });
        await newRecord.save();

        // 2. تحديث رصيد المخدوم
        await Makhdoom.findByIdAndUpdate(makhdoomId, { $inc: { totalPoints: pointsToAdd } });

        res.json({ message: "تم التسجيل", pointsAdded: pointsToAdd });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server Running on Port ${PORT}`));