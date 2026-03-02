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
    command: ['dar', 'regalo', 'darputa'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // --- Obtener usuario destino (prioridad: mención > cita > número en args) ---
            let targetId;
            const mentioned = m.mentionedJid;
            
            // Si hay mención, usamos la primera
            if (mentioned.length > 0) {
                targetId = await resolveLidToRealJid(mentioned[0], client, m.chat);
            }
            // Si no hay mención pero hay mensaje citado
            else if (m.quoted) {
                targetId = await resolveLidToRealJid(m.quoted.sender, client, m.chat);
            }
            // Si no hay mención ni cita, intentamos tomar el último argumento como número
            else if (args.length > 0) {
                // El último argumento podría ser un número
                const possibleNumber = args[args.length - 1];
                // Si parece un número (solo dígitos, quizás con +)
                if (/^\+?\d+$/.test(possibleNumber)) {
                    targetId = normalizeNumber(possibleNumber);
                    // Quitamos ese último argumento de args para que no interfiera con el identificador
                    args.pop();
                } else {
                    return client.reply(m.chat, formatMessage('❀ Debes mencionar al usuario, citar un mensaje o proporcionar un número.'), m);
                }
            } else {
                return client.reply(m.chat, formatMessage('❀ Debes mencionar al usuario, citar un mensaje o proporcionar un número.'), m);
            }

            if (!targetId) {
                return client.reply(m.chat, formatMessage('❀ No se pudo determinar el usuario destino.'), m);
            }

            // --- Obtener identificador del personaje (todo lo que sobra en args) ---
            if (args.length < 1) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID o nombre del personaje.\nEjemplo: #dar 100001 @usuario  o  #dar Lelouch @usuario'), m);
            }

            const identifier = args.join(' ').trim(); // Ya quitamos el último si era número

            await m.react('🕒');

            // Cargar catálogo
            let catalog;
            try {
                catalog = await loadCharacters();
            } catch (e) {
                console.error('Error al cargar characters.json:', e);
                return client.reply(m.chat, formatMessage('❀ Error al cargar el catálogo de personajes.'), m);
            }

            const allCharacters = flattenCharacters(catalog);

            // Buscar personaje por ID o nombre
            let character;
            if (/^\d+$/.test(identifier)) {
                character = allCharacters.find(c => String(c.id) === identifier);
            } else {
                character = allCharacters.find(c => c.name.toLowerCase() === identifier.toLowerCase()) ||
                            allCharacters.find(c => c.name.toLowerCase().includes(identifier.toLowerCase()));
            }

            if (!character) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ No se encontró ningún personaje con el identificador: *${identifier}*.`), m);
            }

            const charId = String(character.id);
            const charName = character.name;

            // ========== PREPARAR ESTRUCTURAS ==========
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {}, characters: {} };
            if (!global.db.data.chats[m.chat].users) global.db.data.chats[m.chat].users = {};
            if (!global.db.data.chats[m.chat].characters) global.db.data.chats[m.chat].characters = {};

            // Asegurar entrada del personaje en el chat
            if (!global.db.data.chats[m.chat].characters[charId]) {
                global.db.data.chats[m.chat].characters[charId] = {
                    name: charName,
                    value: character.value || 100,
                    user: null,
                    claimedAt: null
                };
            }

            // Asegurar que el usuario destino tenga objeto en el chat
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

            // --- Verificar si el personaje ya tiene dueño ---
            const currentOwnerId = global.db.data.chats[m.chat].characters[charId].user;
            let oldOwnerName = null;

            if (currentOwnerId) {
                // Guardar nombre del antiguo dueño para el mensaje
                oldOwnerName = global.db.data.users[currentOwnerId]?.name || currentOwnerId.split('@')[0];
                
                // Quitar el personaje del array del antiguo dueño
                if (global.db.data.chats[m.chat].users[currentOwnerId]?.characters) {
                    global.db.data.chats[m.chat].users[currentOwnerId].characters = 
                        global.db.data.chats[m.chat].users[currentOwnerId].characters.filter(id => id !== charId);
                }
                
                // Si el antiguo dueño lo tenía como favorito, eliminar favorito
                if (global.db.data.chats[m.chat].users[currentOwnerId]?.favorite === charId) {
                    delete global.db.data.chats[m.chat].users[currentOwnerId].favorite;
                }
                if (global.db.data.users[currentOwnerId]?.favorite === charId) {
                    delete global.db.data.users[currentOwnerId].favorite;
                }
            }

            // --- Añadir el personaje al nuevo dueño ---
            if (!global.db.data.chats[m.chat].users[targetId].characters.includes(charId)) {
                global.db.data.chats[m.chat].users[targetId].characters.push(charId);
            }

            // Actualizar la propiedad en chat.characters
            global.db.data.chats[m.chat].characters[charId].user = targetId;
            global.db.data.chats[m.chat].characters[charId].claimedAt = Date.now();

            // ========== TAMBIÉN GUARDAR EN users GLOBAL ==========
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
            
            // Mensaje personalizado según si había dueño previo
            let replyMsg;
            if (currentOwnerId) {
                replyMsg = formatMessage(`❀ Personaje *${charName}* (ID: ${charId}) transferido de ${oldOwnerName} a @${targetId.split('@')[0]}.`);
            } else {
                replyMsg = formatMessage(`❀ Personaje *${charName}* (ID: ${charId}) ha sido dado a @${targetId.split('@')[0]}.`);
            }
            
            client.reply(m.chat, replyMsg, m, { mentions: [targetId] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
