// plugins/owner-givechar.js
import { resolveLidToRealJid } from "../../lib/utils.js"
import { promises as fs } from 'fs'

const charactersFilePath = './lib/characters.json'

async function loadCharacters() {
    const data = await fs.readFile(charactersFilePath, 'utf-8')
    return JSON.parse(data)
}

function flattenCharacters(structure) {
    return Object.values(structure).flatMap(s => Array.isArray(s.characters) ? s.characters : [])
}

const formatMessage = (text) => `《✧》 ${text}`;

export default {
    command: ['givechar', 'addchar', 'givecharacter'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Obtener usuario destino (mención o cita)
            const mentioned = m.mentionedJid;
            const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : null);
            if (!who2) {
                return client.reply(m.chat, formatMessage('❀ Por favor, menciona al usuario o cita un mensaje.'), m);
            }
            const who = await resolveLidToRealJid(who2, client, m.chat);

            // El primer argumento puede ser ID o nombre
            const query = args.find(arg => !arg.startsWith('@') && !arg.includes('@'));
            if (!query) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID o nombre del personaje.\nEjemplo: #givechar 100001 @usuario\nO: #givechar Lelouch @usuario'), m);
            }

            await m.react('🕒');

            // Cargar catálogo de personajes
            let catalog;
            try {
                catalog = await loadCharacters();
            } catch (e) {
                console.error('Error al cargar characters.json:', e);
                return client.reply(m.chat, formatMessage('❀ Error al cargar el catálogo de personajes.'), m);
            }

            const allCharacters = flattenCharacters(catalog);

            // Determinar si es ID o nombre
            let character;
            if (/^\d+$/.test(query)) { // es numérico
                character = allCharacters.find(ch => ch.id == query);
                if (!character) {
                    await m.react('✖️');
                    return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con ID *${query}*.`), m);
                }
            } else {
                // Búsqueda por nombre (case insensitive)
                const matches = allCharacters.filter(ch => ch.name.toLowerCase().includes(query.toLowerCase()));
                if (matches.length === 0) {
                    await m.react('✖️');
                    return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con nombre *${query}*.`), m);
                }
                if (matches.length > 1) {
                    // Múltiples coincidencias: mostrar opciones
                    let msg = `❀ Se encontraron varios personajes con *${query}*:\n\n`;
                    matches.slice(0, 10).forEach((ch, i) => { // limitar a 10
                        msg += `${i + 1}. *${ch.name}* (ID: ${ch.id})\n`;
                    });
                    if (matches.length > 10) msg += `\n... y ${matches.length - 10} más.`;
                    msg += `\n\nUsa el ID para seleccionar uno.`;
                    await m.react('✖️');
                    return client.reply(m.chat, formatMessage(msg), m);
                }
                character = matches[0];
            }

            const characterId = character.id;
            const characterName = character.name;

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

            // Evitar duplicados
            if (global.db.data.chats[m.chat].users[who].characters.includes(characterId)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${characterName}* (ID: ${characterId}).`), m);
            }

            // Añadir el ID al array del chat
            global.db.data.chats[m.chat].users[who].characters.push(characterId);

            // ========== TAMBIÉN GUARDAR EN users GLOBAL (por compatibilidad) ==========
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
            client.reply(m.chat, formatMessage(`❀ Personaje *${characterName}* (ID: ${characterId}) añadido a @${who.split('@')[0]}.`), m, { mentions: [who] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
