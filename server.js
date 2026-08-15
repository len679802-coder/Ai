const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const SCRIPT_DIR = path.join(ROOT, "scripts");
const DB_FILE = path.join(ROOT, "database.json");

if (!fs.existsSync(SCRIPT_DIR)) {
    fs.mkdirSync(SCRIPT_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "[]", "utf8");
}

app.use(express.json({ limit: "5mb" }));

/*
    index.html อยู่ข้าง server.js
*/
app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
});

/*
    อ่านฐานข้อมูล
*/
function readDB() {
    try {
        return JSON.parse(
            fs.readFileSync(DB_FILE, "utf8")
        );
    } catch {
        return [];
    }
}

/*
    เขียนฐานข้อมูล
*/
function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

/*
    สร้าง ID
*/
function createID() {
    return crypto
        .randomBytes(12)
        .toString("base64url");
}

/*
    ทำความสะอาดชื่อ
*/
function cleanName(name) {
    return String(name || "Untitled")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .trim()
        .slice(0, 80) || "Untitled";
}

/*
    สร้าง Script
*/
app.post("/api/scripts", (req, res) => {

    try {

        const name = cleanName(req.body.name);
        const code = req.body.code;

        if (
            typeof code !== "string" ||
            !code.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: "ไม่พบ Lua code"
            });
        }

        if (code.length > 2000000) {
            return res.status(413).json({
                success: false,
                error: "Script ใหญ่เกินไป"
            });
        }

        const db = readDB();

        let id;

        do {
            id = createID();
        } while (
            db.some(item => item.id === id)
        );

        const filename = `${id}.lua`;
        const filepath = path.join(
            SCRIPT_DIR,
            filename
        );

        fs.writeFileSync(
            filepath,
            code,
            "utf8"
        );

        const item = {
            id,
            name,
            filename,
            size: Buffer.byteLength(code, "utf8"),
            createdAt: new Date().toISOString()
        };

        db.push(item);
        writeDB(db);

        const baseURL =
            `${req.protocol}://${req.get("host")}`;

        res.json({
            success: true,
            id,
            name,
            size: item.size,
            createdAt: item.createdAt,
            url: `${baseURL}/scripts/${filename}`
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Server error"
        });
    }
});

/*
    รายการ Script
*/
app.get("/api/scripts", (req, res) => {

    const db = readDB();

    const baseURL =
        `${req.protocol}://${req.get("host")}`;

    res.json(
        db.map(item => ({
            ...item,
            url:
                `${baseURL}/scripts/${item.filename}`
        }))
    );
});

/*
    เปิด Lua Script
*/
app.get("/scripts/:filename", (req, res) => {

    const filename =
        path.basename(req.params.filename);

    if (!filename.endsWith(".lua")) {
        return res.status(400).send(
            "-- Invalid script"
        );
    }

    const filepath =
        path.join(SCRIPT_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).send(
            "-- Script not found"
        );
    }

    res.type("text/plain");

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.send(
        fs.readFileSync(filepath, "utf8")
    );
});

/*
    ลบ Script
*/
app.delete("/api/scripts/:id", (req, res) => {

    const id = String(req.params.id);

    const db = readDB();

    const item =
        db.find(x => x.id === id);

    if (!item) {
        return res.status(404).json({
            success: false,
            error: "ไม่พบ Script"
        });
    }

    const filepath =
        path.join(SCRIPT_DIR, item.filename);

    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }

    writeDB(
        db.filter(x => x.id !== id)
    );

    res.json({
        success: true
    });
});

/*
    Server Status
*/
app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        scripts: readDB().length,
        time: new Date().toISOString()
    });
});

app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("          REDLUA SERVER");
    console.log("================================");
    console.log("");
    console.log(
        `http://localhost:${PORT}`
    );
    console.log("");
});
