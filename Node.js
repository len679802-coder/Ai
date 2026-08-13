const express = require('express');
const app = express();
app.use(express.json());

// จำลอง Database เก็บสคริปต์ (ของจริงให้ใช้ MongoDB หรือ MySQL)
const database = {
    "SCR_123456": {
        owner: "Admin",
        url: "https://mywebsite.com",
        scriptContent: "print('Hello from Secure Database!')"
    }
};

// API สำหรับให้ Roblox มาดึงสคริปต์
app.get('/api/get-script/:id', (req, res) => {
    const scriptId = req.params.id;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // ตรวจสอบความปลอดภัยเบื้องต้น (เช่น เช็ค Rate Limit, Token หรือ Blacklist IP)
    if (!database[scriptId]) {
        return res.status(403).json({ status: "Error", message: "Invalid Script ID or Unauthorized!" });
    }

    // ส่งโค้ดกลับไปแบบเข้ารหัสหรือ JSON ปกติ
    res.json({
        status: "Success",
        owner: database[scriptId].owner,
        script: database[scriptId].scriptContent
    });
});

app.listen(3000, () => console.log('Secure Backend running on port 3000'));
