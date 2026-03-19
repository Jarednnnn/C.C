import cuentasCrunchyroll from 'commands/utils/cuentas.js';

export default {
  command: ['crunchyroll', 'cuenta'],
  category: 'main',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      await m.react('🕒');

      const chat = global.db.data.chats[m.chat];
      if (!chat.crunchyroll) {
        chat.crunchyroll = { accounts: [], users: {} };
      }
      const crunchy = chat.crunchyroll;

      // Inicializar cuentas si no hay ninguna
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

      const sentMsg = await m.reply(mensaje);
      setTimeout(async () => {
        try {
          await client.sendMessage(m.chat, { delete: sentMsg.key });
        } catch (e) {
          // Ignorar si el mensaje ya fue eliminado
        }
      }, 30000);

      await m.react('✔️');
    } catch (e) {
      await m.react('✖️');
      // Revertir cambios si ocurrió un error después de asignar
      const chat = global.db.data.chats[m.chat];
      if (chat?.crunchyroll?.users?.[m.sender]?.lastClaim) {
        delete chat.crunchyroll.users[m.sender].lastClaim;
        // Buscar la cuenta asignada y desasignarla
        const cuentaAsignada = chat.crunchyroll.accounts.find(acc => acc.assignedTo === m.sender && acc.assigned === true);
        if (cuentaAsignada) {
          cuentaAsignada.assigned = false;
          cuentaAsignada.assignedTo = null;
        }
      }
      return m.reply(`> Ocurrió un error inesperado. Intenta de nuevo.\n> Error: ${e.message}`);
    }
  }
};

function msToTime(duration) {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days} día${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hora${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} segundo${seconds > 1 ? 's' : ''}`);

  return parts.join(', ');
}
