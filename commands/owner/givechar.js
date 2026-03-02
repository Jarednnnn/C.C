// plugins/owner-givechar.js
import { resolveLidToRealJid } from "../../lib/utils.js"

const formatMessage = (text) => `《✧》 ${text}`;

export default {
    command: ['givechar', 'addchar', 'givecharacter'],
    isOwner: true, // Solo el owner puede usar este comando
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Obtener el usuario destino (mención o cita)
            const mentioned = m.mentionedJid;
            const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : null);
            if (!who2) {
                return client.reply(m.chat, formatMessage('❀ Por favor, menciona al usuario o cita un mensaje.'), m);
            }

            // Resolver el JID real (por si es un LID)
            const who = await resolveLidToRealJid(who2, client, m.chat);

            // El nombre del personaje es el primer argumento que no sea una mención
            const characterName = args.find(arg => !arg.startsWith('@') && !arg.includes('@'));
            if (!characterName) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el nombre o ID del personaje.\nEjemplo: #givechar Naruto @usuario'), m);
            }

            await m.react('🕒');

            // Asegurar estructura del chat
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {} };
            if (!global.db.data.chats[m.chat].users) global.db.data.chats[m.chat].users = {};

            // Asegurar que el usuario destino tiene entrada en este chat
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

            // Asegurar que el array characters existe
            if (!global.db.data.chats[m.chat].users[who].characters) {
                global.db.data.chats[m.chat].users[who].characters = [];
            }

            // Opcional: evitar duplicados (si quieres permitir duplicados, comenta estas líneas)
            if (global.db.data.chats[m.chat].users[who].characters.includes(characterName)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario ya tiene el personaje *${characterName}*.`), m);
            }

            // Añadir el personaje
            global.db.data.chats[m.chat].users[who].characters.push(characterName);

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`❀ Personaje *${characterName}* añadido a @${who.split('@')[0]}.`), m, { mentions: [who] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
