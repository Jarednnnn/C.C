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

seeCommands()

export default async (client, m) => {
if (!m.message) return
const sender = m.sender 
let body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply?.selectedRowId || m.message.templateButtonReplyMessage?.selectedId || ''

initDB(m, client)
antilink(client, m)

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (plugin && typeof plugin.all === "function") {
try {
await plugin.all.call(client, m, { client })
} catch (err) {
console.error(`Error en plugin.all -> ${name}`, err)
}}}
  
const from = m.key.remoteJid
const botJid = client.user.id.split(':')[0] + '@s.whatsapp.net'
const chat = global.db.data.chats[m.chat] || {}
const settings = global.db.data.settings[botJid] || {}  
const user = global.db.data.users[sender] ||= {}
const users = chat.users?.[sender] || {}
const rawBotname = settings.namebot || 'Yuki'
const namebot = /^[\w\s]+$/.test(rawBotname) ? rawBotname : 'Yuki'

// --- DETECCIÓN DE ADMINS MEJORADA ---
let groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch(() => null) : null
let participants = groupMetadata?.participants || []

// Función interna para extraer SOLO los números (limpia :1, @s.whatsapp.net, @c.us)
const parseJid = (jid) => jid ? jid.split('@')[0].split(':')[0] : ''
const senderNumber = parseJid(sender)
const botNumber = parseJid(botJid)

// Extraemos los números de los admins
const groupAdmins = participants.filter(p => p.admin !== null).map(p => parseJid(p.id))

const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber) : false
const isAdmins = m.isGroup ? groupAdmins.includes(senderNumber) : false
const isOwners = [botNumber, ...(settings.owner || []), ...global.owner].some(num => String(num).includes(senderNumber))

// --- LÓGICA DE COMANDO ---
const prefixRegex = new RegExp('^[' + (settings.prefix === true ? '' : Array.isArray(settings.prefix) ? settings.prefix.join('') : settings.prefix || './#') + ']', 'i')
const isCommand = prefixRegex.test(m.text)

if (!isCommand) return

let usedPrefix = m.text.match(prefixRegex)?.[0] || ''
let args = m.text.slice(usedPrefix.length).trim().split(" ")
let command = (args.shift() || '').toLowerCase()
let text = args.join(' ')

const cmdData = global.comandos.get(command)
if (!cmdData) return

// --- VALIDACIONES FINALES ---
if (cmdData.isOwner && !isOwners) return
if (cmdData.isAdmin && !isAdmins) return m.reply('《✧》 Este comando solo puede ser ejecutado por los Administradores del Grupo.')
if (cmdData.botAdmin && !isBotAdmins) return m.reply('《✧》 Necesito ser Administrador para ejecutar esto.')

try {
await client.readMessages([m.key])
user.usedcommands = (user.usedcommands || 0) + 1
await cmdData.run(client, m, { args, usedPrefix, command, text, isAdmins, isBotAdmins, isOwners, groupMetadata })
} catch (error) {
console.error(error)
m.reply(`《✧》 Error: ${error.message}`)
}
level(m)
}
