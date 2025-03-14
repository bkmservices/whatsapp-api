// server.js
const express = require('express');
const startBot = require('./bot');
const app = express();

// Utiliser un port par défaut ou un port configuré par Render
const port = process.env.PORT || 3000;

// Middleware pour parser le corps des requêtes en JSON
app.use(express.json());

// Démarrer le bot WhatsApp
let sock;
startBot().then((s) => {
    sock = s;
    console.log('Bot démarré et connecté à WhatsApp');
});

// Route pour envoyer un message via WhatsApp
app.post('/send-message', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).send({ error: 'Numéro de téléphone et message requis.' });
    }

    try {
        const jid = `${phoneNumber}@s.whatsapp.net`; // Format du JID (identifiant WhatsApp)
        await sock.sendMessage(jid, { text: message });
        res.status(200).send({ success: 'Message envoyé avec succès.' });
    } catch (error) {
        console.error('Erreur d\'envoi du message:', error);
        res.status(500).send({ error: 'Erreur lors de l\'envoi du message.' });
    }
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`API WhatsApp disponible sur http://localhost:${port}`);
});
