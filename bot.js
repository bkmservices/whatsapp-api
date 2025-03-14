// bot.js
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { state, saveState } = useSingleFileAuthState('./auth_info.json'); // Utiliser un fichier pour stocker l'état d'authentification

// Fonction pour démarrer le bot avec l'authentification par code
async function startBot() {
    const sock = makeWASocket({
        auth: state, // Authentification avec l'état sauvegardé
        printQRInTerminal: false, // Ne pas afficher le QR code, car vous utilisez un code d'authentification
    });

    // Écouter l'événement d'authentification et fournir le code pour se connecter
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (connection === 'close') {
            console.log('Connexion fermée', lastDisconnect.error);
            process.exit(); // Sortir du processus si la connexion est fermée
        } else if (connection === 'open') {
            console.log('Connexion établie avec WhatsApp');
        }

        // Si un code d'authentification est reçu, vous pouvez l'afficher pour l'entrée manuelle
        if (qr) {
            console.log('Code d\'authentification reçu:', qr);
            // Si vous avez besoin de guider l'utilisateur pour entrer le code, vous pouvez l'afficher ici.
            console.log('Veuillez entrer ce code dans WhatsApp');
        }
    });

    // Sauvegarder l'état de l'authentification à chaque mise à jour
    sock.ev.on('creds.update', saveState);

    return sock; // Retourner l'instance du socket pour utilisation dans l'API
}

module.exports = startBot;
