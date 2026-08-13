const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งคีย์ด้วย environment variable
// ตัวอย่าง:
// ENCRYPTION_KEY=my-secret-key node server.js
const rawKey = process.env.ENCRYPTION_KEY;

if (!rawKey) {
    console.error("ERROR: กรุณาตั้งค่า ENCRYPTION_KEY ก่อนรันเซิร์ฟเวอร์");
    process.exit(1);
}

const ENCRYPTION_KEY = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest();

const IV_LENGTH = 16;

app.use(express.json({ limit: "1mb" }));

// ให้ Express เปิด index.html
app.use(express.static(__dirname));


// ===============================
// ENCRYPT
// ===============================

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        ENCRYPTION_KEY,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);

    return (
        iv.toString("hex") +
        ":" +
        encrypted.toString("hex")
    );
}


// ===============================
// DECRYPT
// ===============================

function decrypt(text) {
    const parts = text.split(":");

    if (parts.length !== 2) {
        throw new Error("Invalid encrypted data");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");

    const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        ENCRYPTION_KEY,
        iv
    );

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
}


// ===============================
// DATABASE DEMO
// ===============================

// ตอนนี้เก็บใน RAM
// ถ้าปิด Node.js ข้อมูลจะหาย
const database = new Map();


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


// ===============================
// SAVE SCRIPT
// ===============================

app.post("/api/save-script", (req, res) => {

    try {

        const { scriptContent } = req.body || {};

        if (
            typeof scriptContent !== "string" ||
            !scriptContent.trim()
        ) {

            return res.status(400).json({
                success: false,
                error: "No script provided"
            });

        }


        // สร้าง ID แบบสุ่ม
        const scriptId =
            "sec_" +
            crypto.randomBytes(8).toString("hex");


        // เข้ารหัสก่อนเก็บ
        const encryptedData =
            encrypt(scriptContent);


        database.set(scriptId, {

            encryptedData,

            createdAt: Date.now()

        });


        console.log(
            "Created script:",
            scriptId
        );


        return res.json({

            success: true,

            scriptId

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            error: "Could not save script"

        });

    }

});


// ===============================
// GET SCRIPT
// ===============================

app.get("/api/get-script/:id", (req, res) => {

    const scriptId =
        req.params.id;


    const item =
        database.get(scriptId);


    if (!item) {

        return res.status(404).json({

            status: "Error",

            error: "Script not found"

        });

    }


    try {

        const scriptContent =
            decrypt(
                item.encryptedData
            );


        return res.json({

            status: "Success",

            scriptId,

            scriptContent

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            status: "Error",

            error: "Decryption failed"

        });

    }

});


// ===============================
// SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `Secure Script Vault running at http://localhost:${PORT}`
    );

});
