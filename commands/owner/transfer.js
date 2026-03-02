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

// Función para reemplazar todas las ocurrencias de un ID por otro en todo el objeto (copiando)
function deepReplaceId(obj, oldId, newId) {
    if (typeof obj === 'string') {
        // Si es un string que coincide exactamente con el ID, lo reemplazamos
        return obj === oldId ? newId : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepReplaceId(item, oldId, newId));
    }
    if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            // Reemplazar también en las claves si son IDs
            const newKey = deepReplaceId(key, oldId, newId);
            newObj[newKey] = deepReplaceId(value, oldId, newId);
        }
        return newObj;
    }
    return obj;
}

export default {
    command: ['transfer', 'trf'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            if (args.length < 2) {
                return client.reply(m.chat, formatMessage('Uso: #transfer <numero_origen> <numero_destino>\nEjemplo: #transfer 593981305645 593994524688'), m);
            }

            const origen = normalizeNumber(args[0]);
            const destino = normalizeNumber(args[1]);

            if (origen === destino) {
                return client.reply(m.chat, formatMessage('El origen y destino no pueden ser el mismo número.'), m);
            }

            await m.react('🕒');

            global.loadDatabase();

            // Verificar que el origen exista en users global (aunque podría no tener, pero para evitar errores)
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

            // 1. Transferir datos globales de users (copia profunda)
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

            // 2. Transferir datos de chats (copia profunda)
            for (const chatId in global.db.data.chats) {
                const chat = global.db.data.chats[chatId];
                if (!chat.users || typeof chat.users !== 'object') continue;

                if (chat.users[origen]) {
                    if (!chat.users[destino]) {
                        chat.users[destino] = {
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
                    chat.users[destino] = JSON.parse(JSON.stringify(chat.users[origen]));
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

            // 3. AHORA: Reemplazar TODAS las ocurrencias del ID origen por el ID destino en TODA la base de datos
            // Esto incluye personajes en global.db.data.characters, referencias en 'marry', etc.
            global.db.data = deepReplaceId(global.db.data, origen, destino);

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
};
