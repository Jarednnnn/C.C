// plugins/owner-givechar.js
import { resolveLidToRealJid } from "../../lib/utils.js"
import { promises as fs } from 'fs'

const charactersFilePath = './lib/characters.json'

// Función para cargar catálogo (similar a robwaifu)
async function loadCharacters() {
    try {
        const data = await fs.readFile(charactersFilePath, 'utf-8')
        return JSON.parse(data)
    } catch (e) {
        console.error('Error loading characters:', e)
        return {}
    }
}

// Aplanar la estructura para búsqueda rápida por ID (opcional, pero útil)
function flattenCharacters(structure) {
    let flat = {}
    for (const serieId in structure) {
        const serie = structure[serieId]
        if (serie.characters && Array.isArray(serie.characters)) {
            serie.characters.forEach(ch => {
                flat[ch.id] = ch
            })
        }
    }
    return flat
}

const formatMessage = (text) => `《✧》 ${text}`;

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

            // Cargar catálogo de personajes (si no está ya en memoria global)
            if (!global.allCharacters) {
                const raw = await loadCharacters()
                global.allCharacters = flattenCharacters(raw)
                // También podrías guardar en global.db.data.characters si quieres persistencia
                // global.db.data.characters = global.allCharacters
            }

            // Verificar que el ID exista
            const characterInfo = global.allCharacters[characterId]
            if (!characterInfo) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con ID *${characterId}*.`), m);
            }

            // Asegurar estructura del chat
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {} }
            const chat = global.db.data.chats[m.chat]
            if (!chat.users) chat.users = {}
            if (!chat.users[who]) {
                chat.users[who] = {
                    stats: {},
                    usedTime: null,
                    lastCmd: 0,
                    coins: 0,
                    bank: 0,
                    afk: -1,
                    afkReason: "",
                    characters: []
                }
            }
            const userData = chat.users[who]
            if (!Array.isArray(userData.characters)) userData.characters = []

            // Evitar duplicados
            if (userData.characters.includes(characterId)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${characterInfo.name}* (ID: ${characterId}).`), m);
            }

            // Añadir el ID al array del usuario en el chat
            userData.characters.push(characterId)

            // Opcional: guardar detalles del personaje en chat.characters para referencia (como en robwaifu)
            if (!chat.characters) chat.characters = {}
            if (!chat.characters[characterId]) {
                chat.characters[characterId] = characterInfo
            }

            // También añadir a users global por si acaso
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
                }
            }
            if (!global.db.data.users[who].characters) {
                global.db.data.users[who].characters = []
            }
            if (!global.db.data.users[who].characters.includes(characterId)) {
                global.db.data.users[who].characters.push(characterId)
            }

            // Guardar cambios
            global.saveDatabase()

            await m.react('✔️')
            client.reply(m.chat, formatMessage(`❀ Personaje *${characterInfo.name}* (ID: ${characterId}) añadido a @${who.split('@')[0]}.`), m, { mentions: [who] })

        } catch (error) {
            console.error(error)
            await m.react('✖️')
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m)
        }
    }
}
