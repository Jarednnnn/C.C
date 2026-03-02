// plugins/owner-dar.js
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
    command: ['dar', 'givechar', 'givewaifu'], // 'dar' como principal
    isOwner: true, // Solo owner
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Obtener usuario destino (mención o cita)
            const mentioned = m.mentionedJid;
            const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : null);
            if (!who2) {
                return client.reply(m.chat, formatMessage('❀ Por favor, menciona al usuario o cita un mensaje.'), m);
            }
            const targetId = await resolveLidToRealJid(who2, client, m.chat);

            // El primer argumento es el identificador del personaje (ID o nombre)
            if (args.length < 1) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID o nombre del personaje.\nEjemplo: #dar 100001 @usuario  o  #dar Lelouch @usuario'), m);
            }

            const identifier = args.join(' ').trim(); // Puede ser "100001" o "Lelouch Lamperouge"

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

            // Buscar personaje por ID (si el identificador es un número)
            let character;
            if (/^\d+$/.test(identifier)) { // solo dígitos
                character = allCharacters.find(c => c.id == identifier);
            } else {
                // Buscar por nombre (case insensitive)
                character = allCharacters.find(c => c.name.toLowerCase() === identifier.toLowerCase());
            }

            if (!character) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con el identificador: *${identifier}*.`), m);
            }

            const charId = character.id;
            const charName = character.name;

            // ========== PREPARAR ESTRUCTURAS ==========
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {}, characters: {} };
            if (!global.db.data.chats[m.chat].users) global.db.data.chats[m.chat].users = {};
            if (!global.db.data.chats[m.chat].characters) global.db.data.chats[m.chat].characters = {};

            // Asegurar que el chat tenga una entrada para el personaje (si no existe, la crea)
            if (!global.db.data.chats[m.chat].characters[charId]) {
                global.db.data.chats[m.chat].characters[charId] = {
                    name: charName,
                    value: character.value || 100,
                    // otros campos que quieras copiar
                };
            }

            // Asegurar que el usuario destino tenga su objeto en el chat
            if (!global.db.data.chats[m.chat].users[targetId]) {
                global.db.data.chats[m.chat].users[targetId] = {
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
            if (!Array.isArray(global.db.data.chats[m.chat].users[targetId].characters)) {
                global.db.data.chats[m.chat].users[targetId].characters = [];
            }

            // Verificar si ya lo tiene (opcional, puedes evitar duplicados)
            if (global.db.data.chats[m.chat].users[targetId].characters.includes(charId)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${charName}* (ID: ${charId}).`), m);
            }

            // Añadir el ID al array del usuario destino
            global.db.data.chats[m.chat].users[targetId].characters.push(charId);

            // Asignar la propiedad del personaje en chat.characters (opcional, pero consistente)
            global.db.data.chats[m.chat].characters[charId].user = targetId;

            // ========== TAMBIÉN GUARDAR EN users GLOBAL (por si acaso) ==========
            if (!global.db.data.users[targetId]) {
                global.db.data.users[targetId] = {
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
            if (!Array.isArray(global.db.data.users[targetId].characters)) {
                global.db.data.users[targetId].characters = [];
            }
            if (!global.db.data.users[targetId].characters.includes(charId)) {
                global.db.data.users[targetId].characters.push(charId);
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`❀ Personaje *${charName}* (ID: ${charId}) ha sido dado a @${targetId.split('@')[0]}.`), m, { mentions: [targetId] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
