// plugins/owner-quitarwaifu.js
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

const normalizeNumber = (num) => {
    let cleaned = num.replace(/\s+/g, '');
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
};

export default {
    command: ['quitarwaifu', 'removewaifu', 'quitar'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            // --- 1. Determinar el destinatario (usuario al que se le quitará el personaje) ---
            let targetId = null;
            let argsFiltrados = [...args]; // copia para modificar

            // Prioridad 1: Menciones
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                targetId = await resolveLidToRealJid(m.mentionedJid[0], client, m.chat);
                // Eliminar de args cualquier argumento que sea una mención (contenga @)
                argsFiltrados = argsFiltrados.filter(arg => !arg.includes('@'));
            }
            // Prioridad 2: Mensaje citado
            else if (m.quoted) {
                targetId = await resolveLidToRealJid(m.quoted.sender, client, m.chat);
                // En este caso no hay mención en args, así que no filtramos
            }
            // Prioridad 3: Último argumento si parece un número (sin @)
            else if (args.length > 0) {
                // El último argumento podría ser el número
                const lastArg = args[args.length - 1];
                // Si no tiene @ y parece un número (solo dígitos y quizás +)
                if (!lastArg.includes('@') && /^[0-9+]+$/.test(lastArg)) {
                    targetId = normalizeNumber(lastArg);
                    // Quitamos ese argumento de la lista
                    argsFiltrados.pop();
                }
            }

            if (!targetId) {
                return client.reply(m.chat, formatMessage('❀ Debes mencionar, citar o escribir el número del usuario al que quieres quitar el personaje.'), m);
            }

            // --- 2. Identificador del personaje (lo que queda en argsFiltrados) ---
            if (argsFiltrados.length === 0) {
                return client.reply(m.chat, formatMessage('ꕥ Ingresa el ID o nombre del personaje que deseas quitar.\nEjemplo: #quitarwaifu 100001 @usuario'), m);
            }

            const identifier = argsFiltrados.join(' ').trim();

            await m.react('🕒');

            // Cargar catálogo (para obtener nombre e ID real)
            let catalog;
            try {
                catalog = await loadCharacters();
            } catch (e) {
                console.error('Error al cargar characters.json:', e);
                return client.reply(m.chat, formatMessage('❀ Error al cargar el catálogo de personajes.'), m);
            }

            const allCharacters = flattenCharacters(catalog);

            // Buscar personaje en el catálogo
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

            // ========== VERIFICAR ESTRUCTURAS ==========
            if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = { users: {}, characters: {} };
            if (!global.db.data.chats[m.chat].users) global.db.data.chats[m.chat].users = {};
            if (!global.db.data.chats[m.chat].characters) global.db.data.chats[m.chat].characters = {};

            // Verificar si el personaje existe en la base de datos del chat
            if (!global.db.data.chats[m.chat].characters[charId]) {
                // Si no existe, no puede estar asignado a nadie
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El personaje *${charName}* (ID: ${charId}) no está registrado en este chat.`), m);
            }

            // Verificar que el usuario destino tenga el personaje
            const userData = global.db.data.chats[m.chat].users[targetId];
            if (!userData || !Array.isArray(userData.characters) || !userData.characters.includes(charId)) {
                await m.react('✖️');
                return client.reply(m.chat, formatMessage(`❀ El usuario no posee el personaje *${charName}* (ID: ${charId}).`), m);
            }

            // --- Proceder a quitar el personaje del usuario ---
            // 1. Remover del array de personajes del usuario en el chat
            const indexInChat = userData.characters.indexOf(charId);
            if (indexInChat !== -1) userData.characters.splice(indexInChat, 1);

            // 2. Remover del array global de usuarios (si existe)
            if (global.db.data.users[targetId] && Array.isArray(global.db.data.users[targetId].characters)) {
                const indexGlobal = global.db.data.users[targetId].characters.indexOf(charId);
                if (indexGlobal !== -1) global.db.data.users[targetId].characters.splice(indexGlobal, 1);
            }

            // 3. Liberar el personaje en el chat (poner user a null)
            global.db.data.chats[m.chat].characters[charId].user = null;
            global.db.data.chats[m.chat].characters[charId].claimedAt = null;

            // 4. Limpiar favorito si el usuario tenía este personaje como favorito
            if (userData.favorite === charId) {
                delete userData.favorite;
            }
            if (global.db.data.users[targetId]?.favorite === charId) {
                delete global.db.data.users[targetId].favorite;
            }

            // 5. Limpiar ventas si el personaje estaba en venta por este usuario
            if (global.db.data.chats[m.chat].sales?.[charId] && global.db.data.chats[m.chat].sales[charId].user === targetId) {
                delete global.db.data.chats[m.chat].sales[charId];
            }

            // Guardar cambios
            global.saveDatabase();

            await m.react('✔️');

            // Mensaje de respuesta
            const targetName = global.db.data.users[targetId]?.name || targetId.split('@')[0];
            const replyMsg = `❀ Personaje *${charName}* (ID: ${charId}) ha sido quitado de @${targetId.split('@')[0]}. Ahora está libre.`;

            client.reply(m.chat, formatMessage(replyMsg), m, { mentions: [targetId] });

        } catch (error) {
            console.error(error);
            await m.react('✖️');
            client.reply(m.chat, `⚠︎ Se ha producido un problema.\n${error.message}`, m);
        }
    }
}
