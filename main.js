import moment from 'moment';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import gradient from 'gradient-string';
import seeCommands from './lib/system/commandLoader.js';
import initDB from './lib/system/initDB.js';
import antilink from './commands/antilink.js';
import level from './commands/level.js';

seeCommands();

export default async (client, m) => {
  if (!m.message) return;

  let sender = m.sender || m.key.participant || m.key.remoteJid;
  const normalizeJid = (jid) => jid ? jid.split(':')[0].split('@')[0] + '@s.whatsapp.net' : '';
  sender = normalizeJid(sender);
  const botJid = normalizeJid(client.user.id || client.user.lid);

  let body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply?.selectedRowId || m.message.templateButtonReplyMessage?.selectedId || '';
  m.text = body;

  initDB(m, client);
  antilink(client, m);

  for (const name in global.plugins) {
    const plugin = global.plugins[name];
    if (plugin && typeof plugin.all === "function") {
      try { await plugin.all.call(client, m, { client }); } catch (err) { console.error(`Error plugin.all ${name}`, err); }
    }
  }

  const from = m.key.remoteJid;
  const chat = global.db.data.chats[m.chat] || {};
  const settings = global.db.data.settings[botJid] || {};
  const user = global.db.data.users[sender] ||= {};
  const users = chat.users?.[sender] || {};

  const rawBotname = settings.namebot || 'Yuki';
  const namebot = /^[\w\s]+$/.test(rawBotname) ? rawBotname : 'Yuki';

  // Prefix (sin cambios)
  const shortForms = [namebot.charAt(0), namebot.split(" ")[0], (settings.type || 'Sub').split(" ")[0], namebot.split(" ")[0].slice(0,2), namebot.split(" ")[0].slice(0,3)];
  const prefixes = [...new Set([namebot, ...shortForms])];
  let prefix;
  if (Array.isArray(settings.prefix) || typeof settings.prefix === 'string') {
    const arr = Array.isArray(settings.prefix) ? settings.prefix : [settings.prefix];
    prefix = new RegExp(`^(${prefixes.join('|')})?(${arr.map(p => p.replace(/[|\\{}()[\]^$+*.\-]/g,'\\$&')).join('|')})`, 'i');
  } else if (settings.prefix === true) {
    prefix = /^/i;
  } else {
    prefix = new RegExp(`^(${prefixes.join('|')})?`, 'i');
  }

  let pluginPrefix = client.prefix || prefix;
  let match = null;
  if (pluginPrefix instanceof RegExp) {
    match = [pluginPrefix.exec(m.text), pluginPrefix];
  } else if (Array.isArray(pluginPrefix)) {
    for (const p of pluginPrefix) {
      const regex = p instanceof RegExp ? p : new RegExp(p.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&'));
      const res = regex.exec(m.text);
      if (res) { match = [res, regex]; break; }
    }
  }
  if (!match) return;

  let usedPrefix = (match[0] || [])[0] || '';
  let args = m.text.slice(usedPrefix.length).trim().split(/ +/);
  let command = (args.shift() || '').toLowerCase();
  let text = args.join(' ');

  const pushname = m.pushName || 'Sin nombre';

  // ==================== METADATA + ADMIN DETECTION (RESOLVIENDO LIDs) ====================
  let groupMetadata = null;
  let groupName = '';
  let groupAdmins = [];

  if (m.isGroup) {
    try {
      groupMetadata = await client.groupMetadata(m.chat);
      groupName = groupMetadata.subject || '';
      const participants = groupMetadata.participants;
      groupAdmins = [];
      for (const p of participants) {
        if (p.admin === 'admin' || p.admin === 'superadmin') {
          let adminJid = p.id;
          if (adminJid.endsWith('@lid')) {
            adminJid = await resolveLidToRealJid(adminJid, client, m.chat) || adminJid;
          }
          groupAdmins.push(normalizeJid(adminJid));
        }
      }
    } catch (err) {
      console.error('Error groupMetadata:', err);
    }
  }

  const isBotAdmins = m.isGroup ? groupAdmins.includes(botJid) : false;
  const isAdmins = m.isGroup ? groupAdmins.includes(sender) : false;

  // Debug ENVIADO A OWNER (como en report/suggest)
  if (m.isGroup) {
    let debugMsg = '=== DEBUG ADMIN FIX LID RESOLVED ===\n';
    debugMsg += `m.key.participant → ${m.key.participant || 'N/A'}\n`;
    debugMsg += `m.sender → ${m.sender || 'N/A'}\n`;
    debugMsg += `Normalized sender → ${sender || 'N/A'}\n`;
    debugMsg += `botJid → ${botJid || 'N/A'}\n`;
    debugMsg += `Participants sample: ${JSON.stringify(groupMetadata?.participants?.slice(0,5).map(p => ({id: p.id, admin: p.admin})) || [], null, 2)}\n`;
    debugMsg += `Resolved Group Admins: ${JSON.stringify(groupAdmins || [], null, 2)}\n`;
    debugMsg += `isAdmins → ${isAdmins}\n`;
    debugMsg += `isBotAdmins → ${isBotAdmins}\n`;
    debugMsg += '============================';

    // Envía a los owners, como en el comando report
    for (const num of global.owner) {
      try {
        await client.sendMessage(`${num}@s.whatsapp.net`, { text: debugMsg });
      } catch {}
    }
  }

  // ... (el resto del código exactamente igual que antes: logs, primary bot, banned, private chat, stats, comando, try-catch, level(m))

  const chatData = global.db.data.chats[from] || {};
  const consolePrimary = chatData.primaryBot;
  if (!consolePrimary || consolePrimary === botJid) {
    const h = chalk.bold.blue('╭────────────────────────────···');
    const t = chalk.bold.blue('╰────────────────────────────···');
    const v = chalk.bold.blue('│');
    console.log(`\n${h}\n${chalk.bold.yellow(`${v} Fecha: ${chalk.whiteBright(moment().format('DD/MM/YY HH:mm:ss'))}`)}\n${chalk.bold.blueBright(`${v} Usuario: ${chalk.whiteBright(pushname)}`)}\n${chalk.bold.magentaBright(`${v} Remitente: ${gradient('deepskyblue', 'darkorchid')(sender)}`)}\n${m.isGroup ? chalk.bold.cyanBright(`${v} Grupo: ${chalk.greenBright(groupName)}\n${v} ID: ${gradient('violet', 'midnightblue')(from)}\n`) : chalk.bold.greenBright(`${v} Chat privado\n`)}${t}`);
  }

  const hasPrefix = settings.prefix === true || (Array.isArray(settings.prefix) ? settings.prefix : [settings.prefix || '']).some(p => m.text.startsWith(p));

  function getAllSessionBots() {
    const sessionDirs = ['./Sessions/Subs'];
    let bots = [];
    for (const dir of sessionDirs) {
      try {
        const subDirs = fs.readdirSync(path.resolve(dir));
        for (const sub of subDirs) {
          if (fs.existsSync(path.resolve(dir, sub, 'creds.json'))) {
            bots.push(sub + '@s.whatsapp.net');
          }
        }
      } catch {}
    }
    try {
      if (fs.existsSync('./Sessions/Owner/creds.json')) {
        bots.push(normalizeJid(global.client?.user?.id));
      }
    } catch {}
    return bots;
  }

  const botprimaryId = chat?.primaryBot;
  if (botprimaryId && botprimaryId !== botJid) {
    if (hasPrefix) {
      const participants = m.isGroup ? (await client.groupMetadata(m.chat).catch(() => ({ participants: [] }))).participants : [];
      const primaryInGroup = participants.some(p => normalizeJid(p.id) === normalizeJid(botprimaryId));
      const primaryInSessions = getAllSessionBots().includes(normalizeJid(botprimaryId));
      if (!primaryInSessions || !primaryInGroup) return;
    }
  }

  if (m.id?.startsWith("3EB0") || (m.id?.startsWith("BAE5") && m.id.length === 16) || (m.id?.startsWith("B24E") && m.id.length === 20)) return;

  const isOwners = [botJid, ...(settings.owner ? [normalizeJid(settings.owner)] : []), ...global.owner.map(num => normalizeJid(num + '@s.whatsapp.net'))].includes(sender);

  if (!isOwners && settings.self) return;

  if (!m.chat.endsWith('g.us')) {
    const allowed = ['report','reporte','sug','suggest','invite','invitar','setname','setbotname','setbanner','setmenubanner','setusername','setpfp','setimage','setbotcurrency','setbotprefix','setstatus','setbotowner','reload','code','qr'];
    if (!isOwners && !allowed.includes(command)) return;
  }

  if (chat?.isBanned && !(command === 'bot' && text === 'on') && !global.owner.map(n => normalizeJid(n + '@s.whatsapp.net')).includes(sender)) {
    return m.reply(`ꕥ El bot *${settings.botname || 'Yuki'}* está desactivado en este grupo.\n\n> ✎ Un *administrador* puede activarlo con:\n> » *${usedPrefix}bot on*`);
  }

  const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  const userrs = chatData.users?.[sender] || {};
  if (!userrs.stats) userrs.stats = {};
  if (!userrs.stats[today]) userrs.stats[today] = { msgs: 0, cmds: 0 };
  userrs.stats[today].msgs++;

  if (chat.adminonly && !isAdmins) return;

  if (!command) return;

  const cmdData = global.comandos.get(command);
  if (!cmdData) {
    if (settings.prefix === true) return;
    await client.readMessages([m.key]);
    return m.reply(`ꕤ El comando *${command}* no existe.\n✎ Usa *${usedPrefix}help* para ver la lista.`);
  }

  if (cmdData.isOwner && !isOwners) {
    if (settings.prefix === true) return;
    return m.reply(`ꕤ El comando *${command}* no existe.\n✎ Usa *${usedPrefix}help* para ver la lista.`);
  }

  if (cmdData.isAdmin && !isAdmins) return client.reply(m.chat, mess.admin, m);
  if (cmdData.botAdmin && !isBotAdmins) return client.reply(m.chat, mess.botAdmin, m);

  try {
    await client.readMessages([m.key]);
    user.usedcommands = (user.usedcommands || 0) + 1;
    settings.commandsejecut = (settings.commandsejecut || 0) + 1;
    users.usedTime = new Date();
    users.lastCmd = Date.now();
    user.exp = (user.exp || 0) + Math.floor(Math.random() * 100);
    user.name = pushname;
    userrs.stats[today].cmds++;
    await cmdData.run(client, m, args, usedPrefix, command, text);
  } catch (error) {
    console.error(error);
    await client.sendMessage(m.chat, { text: `《✧》 Error al ejecutar el comando:\n${error.message || error}` }, { quoted: m });
  }

  level(m);
};
