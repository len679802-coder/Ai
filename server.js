const express = require('express');
const crypto = require('crypto'); // โมดูลเข้ารหัสมาตรฐานของ Node.js
const app = express();
app.use(express.json());

// คีย์ลับสำหรับเข้ารหัสและถอดรหัส (เก็บเป็นความลับ ห้ามให้ใครรู้)
const ENCRYPTION_KEY = crypto.randomBytes(32); // หรือกำหนดเป็นรหัสผ่านตายตัวของคุณ
const IV_LENGTH = 16;

// ฟังก์ชันเข้ารหัสโค้ด Lua
function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// ฟังก์ชันถอดรหัสโค้ด Lua (ใช้ตอนส่งให้ Roblox เท่านั้น)
function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// ฐานข้อมูลจำลอง (ในระบบจริงให้เปลี่ยนไปใช้ MongoDB หรือ MySQL)
const database = {};

// 1. API สำหรับรับสคริปต์จากหน้าเว็บมาเข้ารหัสและบันทึก
app.post('/api/save-script', (req, res) => {
    const { scriptContent } = req.body;
    if (!scriptContent) return res.status(400).json({ error: "No script provided" });

    const scriptId = "sec_" + crypto.randomBytes(6).toString('hex');
    
    // ทำการเข้ารหัสโค้ดก่อนเก็บลงฐานข้อมูล
    const encryptedScript = encrypt(scriptContent);

    database[scriptId] = {
        encryptedData: encryptedScript
    };

    res.json({ success: true, scriptId: scriptId });
});

// 2. API สำหรับให้ Roblox มาดึงสคริปต์ (ป้องกันคนเอาไปเปิดดูในเว็บเบราว์เซอร์)
app.get('/api/get-script/:id', (req, res) => {
    const scriptId = req.params.id;
    const userAgent = req.headers['user-agent'] || "";

    // ป้องกันแฮกเกอร์: ถ้าเปิดผ่าน Browser ทั่วไป (Chrome, Edge, Firefox) ให้บล็อกทันที!
    if (userAgent.includes("Mozilla") && !userAgent.includes("Roblox")) {
        return res.status(403).json({ error: "Access Denied: Web browsers are not allowed!" });
    }

    if (!database[scriptId]) {
        return res.status(404).json({ error: "Script not found or expired!" });
    }

    try {
        // ทำการถอดรหัสเฉพาะตอนที่ Roblox ขอมาเท่านั้น
        const originalScript = decrypt(database[scriptId].encryptedData);

        res.json({
            status: "Success",
            scriptContent: originalScript
        });
    } catch (err) {
        res.status(500).json({ error: "Decryption failed!" });
    }
});

app.listen(3000, () => {
    console.log('Secure Backend running on port 3000');
});
