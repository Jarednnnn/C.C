// plugins/owner-borrarprogreso.js
import { resolveLidToRealJid } from "../../lib/utils.js"

const formatMessage = (text) => `《✧》 ${text}`;

const normalizeNumber = (num) => {
    let cleaned = num.replace(/\s+/g, '');
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
};

// Obtener solo el número (sin dominio) para comparar con global.owner
const getPhoneNumber = (id) => id.split('@')[0];

export default {
    command: ['borrarprogreso', 'deleteprogress', 'resetuser'],
    isOwner: true, // Usa la misma verificación que tus otros comandos
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // Obtener el usuario objetivo (puede ser número o mención)
            let target;
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                target = await resolveLidToRealJid(m.mentionedJid[0], client, m.chat);
            } else if (m.quoted) {
                target = await resolveLidToRealJid(m.quoted.sender, client, m.chat);
            } else if (args.length > 0) {
                target = normalizeNumber(args[0]);
            } else {
                return client.reply(m.chat, formatMessage('Uso: #borrarprogreso <número o @usuario>\nEjemplo: #borrarprogreso 593981305645'), m);
            }

            await m.react('🕒');

            global.loadDatabase();

            // Guardar settings original para restaurar después (por seguridad)
            const originalSettings = JSON.parse(JSON.stringify(global.db.data.settings));

            // Verificar que el usuario exista en users o en algún chat
            const existeEnUsers = !!global.db.data.users[target];
            let existeEnAlgunChat = false;
            for (const chatId in global.db.data.chats) {
                if (global.db.data.chats[chatId].users?.[target]) {
                    existeEnAlgunChat = true;
                    break;
                }
            }
            if (!existeEnUsers && !existeEnAlgunChat) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`El usuario ${target} no existe en la base de datos.`), m);
            }

            // 1. Limpiar referencias en matrimonios (campo 'marry' en users global)
            for (const userId in global.db.data.users) {
                if (global.db.data.users[userId].marry === target) {
                    global.db.data.users[userId].marry = "";
                }
            }

            // 2. Recorrer todos los chats para limpiar datos del usuario y liberar personajes
            for (const chatId in global.db.data.chats) {
                const chat = global.db.data.chats[chatId];

                // a) Eliminar al usuario de chat.users si existe
                if (chat.users && chat.users[target]) {
                    delete chat.users[target];
                }

                // b) Liberar personajes que pertenecían al usuario (en chat.characters)
                if (chat.characters) {
                    for (const charId in chat.characters) {
                        if (chat.characters[charId].user === target) {
                            chat.characters[charId].user = null; // El personaje queda libre
                            // Opcional: también podrías eliminar la entrada si quieres, pero lo común es dejarlo libre
                        }
                    }
                }

                // c) También podrías limpiar arrays de characters en otros usuarios (no debería haber, pero por si acaso)
                // Por ejemplo, si algún usuario tiene un array de personajes, no contiene IDs de usuario, sino de personajes.
            }

            // 3. Eliminar al usuario de global.db.data.users
            delete global.db.data.users[target];

            // 4. Restaurar settings (no deberían haberse modificado, pero por seguridad)
            global.db.data.settings = originalSettings;

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');
            client.reply(m.chat, formatMessage(`Progreso del usuario ${target} eliminado completamente.`), m);

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
