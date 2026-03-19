import cuentasCrunchyroll from 'commands/utils/cuentas.js';

export default {
  command: ['crunchyroll', 'cuenta'],
  category: 'gacha',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat];
    if (!chat.crunchyroll) {
      chat.crunchyroll = { accounts: [], users: {} };
    }
    const crunchy = chat.crunchyroll;

    // Inicializar cuentas desde el import si no hay ninguna
    if (crunchy.accounts.length === 0) {
      crunchy.accounts = cuentasCrunchyroll.map(c => ({ ...c, assigned: false, assignedTo: null }));
    }

    const cooldown = 86400000; // 24 horas
    const now = Date.now();
    const userLast = crunchy.users[m.sender]?.lastClaim || 0;

    // Verificar cooldown
    if (now - userLast < cooldown) {
      const remaining = cooldown - (now - userLast);
      return m.reply(`ꕥ Debes esperar *${msToTime(remaining)}* antes de reclamar otra cuenta.`);
    }

    // Filtrar cuentas disponibles
    const disponibles = crunchy.accounts.filter(acc => !acc.assigned);
    if (disponibles.length === 0) {
      return m.reply(`ꕥ No hay cuentas de *Crunchyroll* disponibles en este momento.`);
    }

    // Seleccionar una cuenta al azar
    const randomIndex = Math.floor(Math.random() * disponibles.length);
    const cuenta = disponibles[randomIndex];
    cuenta.assigned = true;
    cuenta.assignedTo = m.sender;

    // Registrar el reclamo en el usuario
    if (!crunchy.users[m.sender]) crunchy.users[m.sender] = {};
    crunchy.users[m.sender].lastClaim = now;

    const expiryDate = cuenta.expiry ? new Date(cuenta.expiry).toLocaleDateString('es-ES') : 'No especificada';
    const mensaje = `「✿」 *CUENTA CRUNCHYROLL ASIGNADA*\n` +
      `• Usuario: \`${cuenta.user}\`\n` +
      `• Contraseña: \`${cuenta.pass}\`\n` +
      `• Expira: ${expiryDate}\n` +
      `• Detalles: ${cuenta.description || 'Sin descripción'}\n` +
      `\n` +
      `⚠️ *Este mensaje se autodestruirá en 30 segundos. Copia los datos rápido.*`;

    try {
      const sentMsg = await client.sendMessage(m.chat, { text: mensaje }, { quoted: m });
      setTimeout(async () => {
        try {
          await client.sendMessage(m.chat, { delete: sentMsg.key });
        } catch (e) {
          // Ignorar error si el mensaje ya fue eliminado
        }
      }, 30000);
    } catch (e) {
      // Revertir cambios en caso de error
      cuenta.assigned = false;
      cuenta.assignedTo = null;
      crunchy.users[m.sender].lastClaim = userLast;
      await m.reply(`ꕥ Ocurrió un error inesperado. Intenta de nuevo.\n> Error: ${e.message}`);
    }
  }
};

function msToTime(duration) {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const parts = [];
  if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`);
  return parts.join(', ');
}
