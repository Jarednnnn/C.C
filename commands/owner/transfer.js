// plugins/owner-transfer.js
import { resolveLidToRealJid } from "../../lib/utils.js"

const formatMessage = (text) => `《✧》 ${text}`;

const normalizeNumber = (num) => {
    let cleaned = num.replace(/\s+/g, '');
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
};

export default {
    command: ['transfer', 'trf'],
    isOwner: true, // Esto ya usa global.owner automáticamente
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Verificar argumentos
            if (args.length < 2) {
                return client.reply(m.chat, formatMessage('Uso: #transfer <numero_origen> <numero_destino>\nEjemplo: #transfer 593981305645 593994524688'), m);
            }

            const origen = normalizeNumber(args[0]);
            const destino = normalizeNumber(args[1]);

            if (origen === destino) {
                return client.reply(m.chat, formatMessage('El origen y destino no pueden ser el mismo número.'), m);
            }

            await m.react('🕒');

            // Cargar base de datos
            global.loadDatabase();

            // Verificar que el origen exista en users global
            if (!global.db.data.users[origen]) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`El usuario ${origen} no existe en la base de datos.`), m);
            }

            // Crear destino en users global si no existe
            if (!global.db.data.users[destino]) {
                global.db.data.users[destino] = {
                    name: null,
                    exp: 0,
                    level: 0,
                    usedcommands: 0,
                    pasatiempo: "",
                    description: "",
                    marry: "",
                    genre: "",
                    birth: "",
                    metadatos: null,
                    metadatos2: null
                };
            }

            // --- Transferir datos globales de users (copia profunda) ---
            const origenUser = JSON.parse(JSON.stringify(global.db.data.users[origen]));
            global.db.data.users[destino] = origenUser;
            // Resetear origen
            global.db.data.users[origen] = {
                name: null,
                exp: 0,
                level: 0,
                usedcommands: 0,
                pasatiempo: "",
                description: "",
                marry: "",
                genre: "",
                birth: "",
                metadatos: null,
                metadatos2: null
            };

            // --- Transferir datos de todos los chats ---
            for (const chatId in global.db.data.chats) {
                const chat = global.db.data.chats[chatId];
                if (!chat.users || typeof chat.users !== 'object') continue;

                // Si el origen tiene datos en este chat
                if (chat.users[origen]) {
                    // Asegurar que el destino tenga un objeto en este chat
                    if (!chat.users[destino]) {
                        chat.users[destino] = {
                            stats: {},
                            usedTime: null,
                            lastCmd: 0,
                            coins: 0,
                            bank: 0,
                            afk: -1,
                            afkReason: "",
                            characters: []  // Harem
                        };
                    }

                    // Transferir: copia profunda de los datos del origen al destino
                    chat.users[destino] = JSON.parse(JSON.stringify(chat.users[origen]));

                    // Resetear origen en este chat
                    chat.users[origen] = {
                        stats: {},
                        usedTime: null,
                        lastCmd: 0,
                        coins: 0,
                        bank: 0,
                        afk: -1,
                        afkReason: "",
                        characters: []
                    };
                }
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`Progreso transferido exitosamente de ${origen} a ${destino}.`), m);
        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
