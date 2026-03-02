// plugins/transfer.js

import { resolveLidToRealJid } from "../../lib/utils.js"

// Función para normalizar número (agregar @s.whatsapp.net si falta)
function normalizeNumber(num) {
    let cleaned = num.replace(/\s+/g, '');
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
}

// Formato de mensajes decorados (usando el mismo estilo que en addcoin)
const formatMessage = (text) => `《✧》 ${text}`;

export default {
    command: ['transfer', 'trf'],
    isOwner: true, // Solo owners pueden usar este comando
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Verificar argumentos
            if (args.length < 2) {
                return client.reply(m.chat, formatMessage('Uso: #transfer <numero_origen> <numero_destino>\nEjemplo: #transfer 593981305645 593994524688'), m);
            }

            const origenRaw = args[0];
            const destinoRaw = args[1];

            // Normalizar números (agregar @s.whatsapp.net)
            const origen = normalizeNumber(origenRaw);
            const destino = normalizeNumber(destinoRaw);

            // Validar que no sean el mismo
            if (origen === destino) {
                return client.reply(m.chat, formatMessage('El origen y destino no pueden ser el mismo número.'), m);
            }

            await m.react('🕒'); // Reacción de procesando

            // Cargar base de datos (por si acaso)
            global.loadDatabase();

            // Verificar que el origen exista en users
            if (!global.db.data.users || !global.db.data.users[origen]) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`El usuario ${origen} no existe en la base de datos.`), m);
            }

            // Crear destino en users si no existe (con valores por defecto)
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

            // --- Transferir datos globales de users ---
            const origenUser = { ...global.db.data.users[origen] }; // copia
            // Sobrescribir destino con datos del origen
            global.db.data.users[destino] = { ...origenUser };
            // Resetear origen a valores por defecto
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

            // --- Transferir datos de chats (por cada chat donde el origen tenga datos) ---
            // Recorrer todos los chats en global.db.data.chats
            if (global.db.data.chats) {
                for (const chatId in global.db.data.chats) {
                    const chat = global.db.data.chats[chatId];
                    if (!chat.users || typeof chat.users !== 'object') continue;

                    // Si el origen está en este chat
                    if (chat.users[origen]) {
                        // Si el destino no existe en este chat, crear con valores por defecto
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

                        // Transferir: destino obtiene los datos del origen
                        chat.users[destino] = { ...chat.users[origen] };

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
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️'); // Reacción de éxito
            return client.reply(m.chat, formatMessage(`Progreso transferido exitosamente de ${origen} a ${destino}.`), m);

        } catch (error) {
            console.error('Error en comando transfer:', error);
            await m.react('✖️');
            return client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
