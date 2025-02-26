const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const socketIO = require("socket.io");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { body, validationResult } = require("express-validator");
const qrcode = require("qrcode");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = 9000;
const sessionPath = "sessions/";

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

io.on("connection", (socket) => {
    socket.on("StartConnection", async (device) => {
        const deviceSessionPath = path.join(sessionPath, device);
        
        // Vérifier si la session existe
        if (fs.existsSync(deviceSessionPath)) {
            socket.emit("message", "WhatsApp connected");
            socket.emit("ready", device);
        } else {
            const client = new Client({
                authStrategy: new LocalAuth({ clientId: device }), // Utilisation de l'auth local
                logger: pino({ level: "fatal" }),
                puppeteer: { headless: true },
            });

            client.on("qr", (qr) => {
                // Générer le QR Code et l'envoyer au client
                qrcode.toDataURL(qr, (err, url) => {
                    socket.emit("qr", url);
                    socket.emit("message", "QR Code received, scan please!");
                });
            });

            client.on("authenticated", () => {
                socket.emit("message", "WhatsApp authenticated");
                socket.emit("ready", device);
            });

            client.on("ready", () => {
                socket.emit("message", "WhatsApp is ready");
            });

            client.on("disconnected", (reason) => {
                socket.emit("message", `Disconnected: ${reason}`);
            });

            client.initialize();
        }
    });

    socket.on("LogoutDevice", (device) => {
        const deviceSessionPath = path.join(sessionPath, device);

        if (fs.existsSync(deviceSessionPath)) {
            fs.rmdirSync(deviceSessionPath, { recursive: true });
            console.log("Logout device: " + device);
            socket.emit("message", "Logout device: " + device);
        }
    });
});

// Route principale
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/core/device.html"));
});

// Route pour afficher le QR
app.get("/scan/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "/core/index.html"));
});

// Route pour envoyer des messages via query params
app.get("/send", (req, res) => {
    const { number, to, type, message, img } = req.query;
    const deviceSessionPath = path.join(sessionPath, number); 

    if (fs.existsSync(deviceSessionPath)) {
        try {
            // Exécution de l'envoi de message via WhatsApp Web.js (ajoute ta logique ici)
            const client = new Client({
                authStrategy: new LocalAuth({ clientId: number }), // Chargement de la session
            });

            client.on("ready", () => {
                const chat = await client.getChatById(to);
                if (type === "text") {
                    chat.sendMessage(message);
                } else if (type === "image") {
                    chat.sendImage(img, message);
                }
                res.status(200).json({ status: true, message: "success" });
            });

            client.initialize();
        } catch (error) {
            res.status(401).json({ status: false, message: error.message });
        }
    } else {
        res.status(401).json({
            status: false,
            message: "Please scan the QR before using the API",
        });
    }
});

// Route pour envoyer des messages via POST (avec validation)
app.post(
    "/send",
    [
        body("number").notEmpty().isNumeric(),
        body("to").notEmpty().isNumeric(),
        body("type").notEmpty(),
        body("message").notEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: false,
                message: errors.array(),
            });
        }

        const { number, to, type, message } = req.body;
        const deviceSessionPath = path.join(sessionPath, number);

        if (fs.existsSync(deviceSessionPath)) {
            try {
                // Exécution de l'envoi de message via WhatsApp Web.js
                const client = new Client({
                    authStrategy: new LocalAuth({ clientId: number }), // Chargement de la session
                });

                client.on("ready", async () => {
                    const chat = await client.getChatById(to);
                    if (type === "text") {
                        await chat.sendMessage(message);
                    } else if (type === "image") {
                        await chat.sendImage(message);
                    }
                    res.status(200).json({ status: true, message: "success" });
                });

                client.initialize();
            } catch (error) {
                res.status(401).json({ status: false, message: error.message });
            }
        } else {
            res.status(401).json({
                status: false,
                message: "Please scan the QR before using the API",
            });
        }
    }
);

// Route pour le device
app.post("/device", (req, res) => {
    const deviceNumber = req.body.device;
    res.redirect("/scan/" + deviceNumber);
});

// Lancer le serveur
server.listen(port, () => {
    console.log("App running on: " + port);
});
