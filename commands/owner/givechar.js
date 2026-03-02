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
            const userId = await resolveLidToRealJid(who2, client, m.chat);

            // El primer argumento debe ser el ID del personaje (ej. 100001)
            const characterId = args.find(arg => !arg.startsWith('@') && !arg.includes('@'));
            if (!characterId) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID del personaje.\nEjemplo: #givechar 100001 @usuario'), m);
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
            const character = allCharacters.find(ch => ch.id == characterId); // comparación flexible

            if (!character) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con ID *${characterId}*.`), m);
            }

            // ========== GUARDAR EN chat.characters (sistema actual de harem) ==========
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {}, characters: {} };
            if (!global.db.data.chats[m.chat].characters) global.db.data.chats[m.chat].characters = {};

            const chatChars = global.db.data.chats[m.chat].characters;

            // Verificar si el personaje ya está asignado a alguien en este chat
            if (chatChars[characterId]) {
                // Si ya existe, comprobamos a quién pertenece
                const currentOwner = chatChars[characterId].user;
                if (currentOwner === userId) {
                    await m.react('✖️');
                    return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${character.name}* (ID: ${characterId}).`), m);
                } else {
                    // Si pertenece a otro, lo reasignamos (opcional, podrías denegar)
                    // Por ahora, lo reasignamos
                    chatChars[characterId].user = userId;
                }
            } else {
                // Crear nueva entrada
                chatChars[characterId] = {
                    user: userId,
                    name: character.name,
                    value: character.value || 100,
                    // Puedes añadir más campos si son necesarios
                };
            }

            // También podrías guardar en users[userId].characters como respaldo, pero no es necesario para #harem
            // Sin embargo, lo hacemos por compatibilidad futura
            if (!global.db.data.users[userId]) {
                global.db.data.users[userId] = {
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
            if (!global.db.data.users[userId].characters) {
                global.db.data.users[userId].characters = [];
            }
            if (!global.db.data.users[userId].characters.includes(characterId)) {
                global.db.data.users[userId].characters.push(characterId);
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`❀ Personaje *${character.name}* (ID: ${characterId}) añadido a @${userId.split('@')[0]}.`), m, { mentions: [userId] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
