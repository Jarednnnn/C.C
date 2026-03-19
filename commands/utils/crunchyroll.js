import cuentas from 'commands/utils/cuentas.js';

export default {
  command: ['crunchyroll', 'cuenta'],
  category: 'gacha',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat];
    if (!chat.crunchyroll) {
      chat.crunchyroll = { accounts: [], users: {} };
    }
    const crunchy = chat.crunchyroll;
    if (crunchy.accounts.length === 0) {
      crunchy.accounts = cuentas.map(c => ({ ...c, assigned: false, assignedTo: null }));
    }
    const cooldown = 86400000;
    const now = Date.now();
    const userLast = crunchy.users[m.sender]?.lastClaim || 0;
    if (now - userLast < cooldown) {
      const remaining = cooldown - (now - userLast);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return m.reply(`ꕥ Debes esperar *${hours}h ${minutes}m* antes de reclamar otra cuenta.`);
    }
    const disponibles = crunchy.accounts.filter(acc => !acc.assigned);
    if (disponibles.length === 0) {
      return m.reply(`ꕥ No hay cuentas de *Crunchyroll* disponibles en este momento.`);
    }
    const randomIndex = Math.floor(Math.random() * disponibles.length);
    const cuenta = disponibles[randomIndex];
    cuenta.assigned = true;
    cuenta.assignedTo = m.sender;
    if (!crunchy.users[m.sender]) crunchy.users[m.sender] = {};
    crunchy.users[m.sender].lastClaim = now;
    const expiryDate = cuenta.expiry ? new Date(cuenta.expiry).toLocaleDateString('es-ES') : 'No especificada';
    const mensaje = `╭┈ࠢ͜─────────────────────────\n│ ❀ *CUENTA CRUNCHYROLL ASIGNADA*\n├┈ࠢ͜─────────────────────────\n│ • *Usuario:* \`${cuenta.user}\`\n│ • *Contraseña:* \`${cuenta.pass}\`\n│ • *Expira:* ${expiryDate}\n│ • *Detalles:* ${cuenta.description || 'Sin descripción'}\n│\n│ ⚠️ *Este mensaje se autodestruirá en 30 segundos. Copia los datos rápido.*\n╰┈ࠢ͜─────────────────────────`;
    try {
      const sentMsg = await m.reply(mensaje);
      setTimeout(async () => {
        try {
          await client.sendMessage(m.chat, { delete: sentMsg.key });
        } catch (e) {}
      }, 30000);
    } catch (e) {
      cuenta.assigned = false;
      cuenta.assignedTo = null;
      crunchy.users[m.sender].lastClaim = userLast;
      await m.reply(`ꕥ Ocurrió un error inesperado. Intenta de nuevo.\n> Error: ${e.message}`);
    }
  }
};
