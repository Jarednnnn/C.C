import ws from 'ws';
import moment from 'moment';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import gradient from 'gradient-string';
import seeCommands from './lib/system/commandLoader.js';
import initDB from './lib/system/initDB.js';
import antilink from './commands/antilink.js';
import level from './commands/level.js';
import { getGroupAdmins } from './lib/message.js';

// --- UTILIDADES GLOBALES ---
seeCommands()

/**
 * Función limpiadora universal:
 * Convierte IDs como '57300...:1@s.whatsapp.net' en '57300...@s.whatsapp.net'
 * Esto garantiza que la comparación sea un string literal exacto.
 */
const cleanJid = (id) => id && typeof id === 'string' ? id.split('@')[0].split(':')[0] + '@s.whatsapp.net' : id;

const mess = {
    admin: '❌ Esta función solo puede ser utilizada por *Administradores* del grupo.',
    botAdmin: '❌ ¡Error! El bot necesita ser *Administrador* para ejecutar esto.',
    owner: '❌ Este comando es exclusivo para mi *Dueño*.'
};

export default async (client, m) => {
    if (!m.message) return
    
    // Normalización de IDs y Cuerpo del mensaje
    const sender = cleanJid(m.sender) 
    const botJid = cleanJid(client.user.id)
    const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply?.selectedRowId || m.message.templateButtonReplyMessage?.selectedId || ''
    m.text = body // Sincronizamos para evitar errores de undefined en m.text

    initDB(m, client)
    antilink(client, m)

    // Ejecución de plugins globales (all)
    for (const name in global.plugins) {
        const plugin = global.plugins[name]
        if (plugin && typeof plugin.all === "function") {
            try {
                await plugin.all.call(client, m, { client })
            } catch (err) {
                console.error(`Error en plugin.all -> ${name}`, err)
            }
        }
    }

    const from = m.key.remoteJid
    const chat = global.db.data.chats[m.chat] || {}
    const settings = global.db.data.settings[botJid] || {}  
    const user = global.db.data.users[sender] ||= {}
    
    // --- LÓGICA DE PREFIJOS Y COMANDOS ---
    const rawBotname = settings.namebot || 'Yuki'
    const tipo = settings.type || 'Sub'
    const namebot = /^[\w\s]+$/.test(rawBotname) ? rawBotname : 'Yuki'
    const shortForms = [namebot.charAt(0), namebot.split(" ")[0], tipo.split(" ")[0]]
    const prefixes = [namebot, ...shortForms]
    
    let prefix
    if (Array.isArray(settings.prefix) || typeof settings.prefix === 'string') {
        const prefixArray = Array.isArray(settings.prefix) ? settings.prefix : [settings.prefix]
        prefix = new RegExp('^(' + prefixes.join('|') + ')?(' + prefixArray.map(p => p.replace(/[|\\{}()[\]^$+*.\-\^]/g, '\\$&')).join('|') + ')', 'i')
    } else {
        prefix = new RegExp('^(' + prefixes.join('|') + ')?', 'i')
    }

    let pluginPrefix = client.prefix ? client.prefix : prefix
    let match = (pluginPrefix instanceof RegExp ? [[pluginPrefix.exec(m.text), pluginPrefix]] : [[null, null]]).find(p => p[0])

    // Plugins Before
    for (const name in global.plugins) {
        const plugin = global.plugins[name]
        if (plugin && !plugin.disabled && typeof plugin.before === "function") {
            try {
                if (await plugin.before.call(client, m, { client })) continue
            } catch (err) {
                console.error(`Error en plugin.before -> ${name}`, err)
            }
        }
    }

    if (!match) return
    let usedPrefix = (match[0] || [])[0] || ''
    let args = m.text.slice(usedPrefix.length).trim().split(" ")
    let command = (args.shift() || '').toLowerCase()
    let text = args.join(' ')

    // --- DETECTOR DE ADMINS (VERSIÓN UNIVERSAL) ---
    const pushname = m.pushName || 'Sin nombre'
    let groupMetadata = null
    let groupAdmins = []
    let groupName = ''
    
    if (m.isGroup) {
        groupMetadata = await client.groupMetadata(m.chat).catch(() => null)
        groupName = groupMetadata?.subject || ''
        // Mapeamos los IDs de los participantes pasándolos por la limpieza universal
        groupAdmins = groupMetadata?.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => cleanJid(p.id)) || []
    }

    // Comparaciones seguras
    const isBotAdmins = m.isGroup ? groupAdmins.includes(botJid) : false
    const isAdmins = m.isGroup ? groupAdmins.includes(sender) : false
    const isOwners = [botJid, ...(settings.owner ? [cleanJid(settings.owner)] : []), ...global.owner.map(num => cleanJid(num + '@s.whatsapp.net'))].includes(sender)

    // Log de consola profesional
    if (!chat.primaryBot || chat.primaryBot === botJid) {
        console.log(chalk.bold.cyan(`\n───> [ ${command.toUpperCase()} ] <───`))
        console.log(chalk.white(`Uss: ${pushname}\nJid: ${sender}\nGroup: ${m.isGroup ? groupName : 'Privado'}\n`))
    }

    // --- VALIDACIONES DE PERMISOS ---
    if (chat?.isBanned && !isOwners) return
    if (chat.adminonly && !isAdmins) return
    if (!command) return

    const cmdData = global.comandos.get(command)
    if (!cmdData) {
        if (settings.prefix === true) return
        return m.reply(`ꕤ El comando *${command}* no existe. Usa *${usedPrefix}help*`)
    }

    // Bloqueo de seguridad: No crashea porque 'mess' existe arriba
    if (cmdData.isOwner && !isOwners) return m.reply(mess.owner)
    if (cmdData.isAdmin && !isAdmins) return client.sendMessage(m.chat, { text: mess.admin }, { quoted: m })
    if (cmdData.botAdmin && !isBotAdmins) return client.sendMessage(m.chat, { text: mess.botAdmin }, { quoted: m })

    try {
        await client.readMessages([m.key])
        
        // Manejo de Estadísticas
        const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
        if (!user.stats) user.stats = {}
        if (!user.stats[today]) user.stats[today] = { msgs: 0, cmds: 0 }
        
        user.usedcommands = (user.usedcommands || 0) + 1
        user.stats[today].cmds++
        user.name = pushname

        // EJECUCIÓN DEL COMANDO
        await cmdData.run(client, m, { args, usedPrefix, command, text, isAdmins, isBotAdmins, isOwners })
        
    } catch (error) {
        console.error(error)
        await client.sendMessage(m.chat, { text: `《✧》 Error interno\n${error.message || error}` }, { quoted: m })
    }
    
    level(m)
}
