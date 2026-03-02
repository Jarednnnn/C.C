// plugins/owner-givechar.js
import { resolveLidToRealJid } from "../../lib/utils.js"

const formatMessage = (text) => `《✧》 ${text}`;

// Función para buscar un personaje por ID en el catálogo global
// Ajusta esta función según dónde tengas almacenado el catálogo de personajes
function findCharacterById(id) {
    // Suponiendo que el catálogo está en global.characters con la estructura:
    // { "serie_id": { name: "...", characters: [ { id: "...", name: "...", value: ... }, ... ] } }
    const catalog = global.characters || global.db?.data?.characters; // Intenta ambas posibilidades
    if (!catalog) return null;

    for (const serieId in catalog) {
        const serie = catalog[serieId];
        if (serie.characters && Array.isArray(serie.characters)) {
            const character = serie.characters.find(ch => ch.id == id); // comparación flexible (string o número)
            if (character) return character;
        }
    }
    return null;
}

export default {
    command: ['givechar', 'addchar', 'givecharacter'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Obtener usuario destino
            const mentioned = m.mentionedJid;
            const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : null);
            if (!who2) {
                return client.reply(m.chat, formatMessage('❀ Por favor, menciona al usuario o cita un mensaje.'), m);
            }
            const who = await resolveLidToRealJid(who2, client, m.chat);

            // El primer argumento debe ser el ID del personaje (ej. 173827)
            const characterId = args.find(arg => !arg.startsWith('@') && !arg.includes('@'));
            if (!characterId) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID del personaje.\nEjemplo: #givechar 173827 @usuario'), m);
            }

            await m.react('🕒');

            // Buscar el personaje en el catálogo
            const characterData = findCharacterById(characterId);
            if (!characterData) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con ID *${characterId}*.`), m);
            }

            // ========== GUARDAR EN EL CHAT ACTUAL ==========
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {} };
            if (!global.db.data.chats[m.chat].users) global.db.data.chats[m.chat].users = {};
            if (!global.db.data.chats[m.chat].users[who]) {
                global.db.data.chats[m.chat].users[who] = {
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
            if (!global.db.data.chats[m.chat].users[who].characters) {
                global.db.data.chats[m.chat].users[who].characters = [];
            }

            // Evitar duplicados (opcional)
            if (global.db.data.chats[m.chat].users[who].characters.includes(characterId)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${characterData.name}* (ID: ${characterId}).`), m);
            }

            // Añadir el ID al array del chat
            global.db.data.chats[m.chat].users[who].characters.push(characterId);

            // ========== TAMBIÉN GUARDAR EN users GLOBAL (por si acaso) ==========
            if (!global.db.data.users[who]) {
                global.db.data.users[who] = {
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
                    metadatos2: null,
                    characters: []
                };
            }
            if (!global.db.data.users[who].characters) {
                global.db.data.users[who].characters = [];
            }
            if (!global.db.data.users[who].characters.includes(characterId)) {
                global.db.data.users[who].characters.push(characterId);
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`❀ Personaje *${characterData.name}* (ID: ${characterId}) añadido a @${who.split('@')[0]}.`), m, { mentions: [who] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
