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

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return [];
    }
}

function writeDB(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

function createID() {
    return crypto.randomBytes(10).toString("hex");
}

function cleanName(name) {
    return String(name || "Untitled")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .trim()
        .slice(0, 80) || "Untitled";
}

/* หน้าเว็บ */
app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "index.html"));
});

/* สร้าง Script */
app.post("/api/scripts", (req, res) => {
    try {
        const name = cleanName(req.body.name);
        const code = String(req.body.code || "");

        if (!code.trim()) {
            return res.status(400).json({
                error: "กรุณาใส่ Lua Script"
            });
        }

        if (code.length > 5_000_000) {
            return res.status(413).json({
                error: "Script ใหญ่เกินไป"
            });
        }

        const db = readDB();

        let id;

        do {
            id = createID();
        } while (db.some(x => x.id === id));

        const filename = `${id}.lua`;
        const filepath = path.join(SCRIPT_DIR, filename);

        fs.writeFileSync(filepath, code, "utf8");

        const baseURL =
            `${req.protocol}://${req.get("host")}`;

        const scriptURL =
            `${baseURL}/scripts/${filename}`;

        const loader =
            `loadstring(game:HttpGet("${scriptURL}"))()`;

        const item = {
            id,
            name,
            filename,
            size: Buffer.byteLength(code, "utf8"),
            createdAt: new Date().toISOString()
        };

        db.push(item);
        writeDB(db);

        res.json({
            success: true,
            id,
            name,
            url: scriptURL,
            loader
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "เกิดข้อผิดพลาดบน Server"
        });
    }
});

/* รายการ Script */
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

/* Lua endpoint */
app.get("/scripts/:filename", (req, res) => {

    const filename =
        path.basename(req.params.filename);

    if (!filename.endsWith(".lua")) {
        return res.status(400).send(
            "-- Invalid Lua file"
        );
    }

    const filepath =
        path.join(SCRIPT_DIR, filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).send(
            "-- Script not found"
        );
    }

    res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
    );

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.send(
        fs.readFileSync(filepath, "utf8")
    );
});

/* ลบ Script */
app.delete("/api/scripts/:id", (req, res) => {

    const id = String(req.params.id);
    const db = readDB();

    const item =
        db.find(x => x.id === id);

    if (!item) {
        return res.status(404).json({
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

/* Server status */
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
    console.log("           REDLUA VAULT");
    console.log("================================");
    console.log("");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("");
});
