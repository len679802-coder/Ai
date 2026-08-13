const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ===============================
// DEMO DATABASE
// ===============================

const scripts = new Map();
const users = new Map();


// ===============================
// CREATE SCRIPT
// ===============================

app.post("/api/save-script", (req, res) => {

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

    const id =
        "sec_" +
        crypto.randomBytes(8).toString("hex");

    scripts.set(id, {
        scriptContent,
        createdAt: Date.now()
    });

    res.json({
        success: true,
        scriptId: id
    });
});


// ===============================
// SCRIPT API
// ===============================

app.get("/api/get-script/:id", (req, res) => {

    const item =
        scripts.get(req.params.id);

    if (!item) {
        return res.status(404).json({
            status: "Error",
            error: "Script not found"
        });
    }

    res.json({
        status: "Success",
        scriptContent: item.scriptContent
    });
});


// ===============================
// ROBLOX HEARTBEAT
// ===============================

app.post("/api/heartbeat", (req, res) => {

    const {
        userId,
        username,
        placeId,
        jobId
    } = req.body || {};

    if (!userId) {
        return res.status(400).json({
            success: false,
            error: "Missing userId"
        });
    }

    users.set(String(userId), {
        username:
            username || "Unknown",

        placeId:
            String(placeId || ""),

        jobId:
            String(jobId || ""),

        lastSeen:
            Date.now()
    });

    res.json({
        success: true
    });
});


// ===============================
// REMOVE OFFLINE USERS
// ===============================

function cleanUsers() {

    const now = Date.now();

    for (const [id, user] of users) {

        // 30 วินาทีไม่มี heartbeat = offline
        if (
            now - user.lastSeen >
            30 * 1000
        ) {
            users.delete(id);
        }
    }
}

setInterval(
    cleanUsers,
    5000
);


// ===============================
// STATS
// ===============================

app.get("/api/stats", (req, res) => {

    cleanUsers();

    res.json({

        onlineUsers:
            users.size,

        totalScripts:
            scripts.size,

        users: [
            ...users.values()
        ].map(user => ({

            username:
                user.username,

            placeId:
                user.placeId,

            lastSeen:
                Math.floor(
                    (Date.now() - user.lastSeen) / 1000
                )

        }))

    });
});


// ===============================
// DASHBOARD
// ===============================

app.get("/api/dashboard", (req, res) => {

    cleanUsers();

    res.json({

        status: "ONLINE",

        onlineUsers:
            users.size,

        totalScripts:
            scripts.size,

        serverTime:
            new Date().toISOString()

    });
});


// ===============================
// SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});
