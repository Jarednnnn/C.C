import { promises as fs } from 'fs'
import path from 'path'

const CUENTAS_PATH = path.resolve('./commands/utils/cuentas.json') // Ajusta la ruta según tu estructura

export default {
  command: ['cuenta', 'crunchyroll'],
  category: 'gacha',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat]
    
    // Inicializar estructura si no existe
    if (!chat.crunchyroll) {
      chat.crunchyroll = { accounts: [], users: {} }
    }

    // Cargar cuentas desde el JSON si aún no hay
    if (chat.crunchyroll.accounts.length === 0) {
      try {
        const raw = await fs.readFile(CUENTAS_PATH, 'utf-8')
        const cuentas = JSON.parse(raw)
        chat.crunchyroll.accounts = cuentas.map(c => ({ ...c, assigned: false, assignedTo: null }))
        console.log(`✅ Cuentas cargadas en el grupo ${m.chat}`)
      } catch (e) {
        console.error('Error al leer cuentas.json:', e)
        return m.reply('ꕥ Error al cargar las cuentas. Contacta al owner.')
      }
    }

    const crunchy = chat.crunchyroll
    const cooldown = 300000 // 24 horas
    const now = Date.now()
    const userLast = crunchy.users[m.sender]?.lastClaim || 0

    if (now - userLast < cooldown) {
      const remaining = cooldown - (now - userLast)
      const hours = Math.floor(remaining / 3600000)
      const minutes = Math.floor((remaining % 3600000) / 60000)
      return m.reply(`ꕥ Debes esperar *${hours}h ${minutes}m* antes de reclamar otra cuenta.`)
    }

    const disponibles = crunchy.accounts.filter(acc => !acc.assigned)
    if (disponibles.length === 0) {
      return m.reply('ꕥ No hay cuentas de *Crunchyroll* disponibles en este momento.')
    }

    const randomIndex = Math.floor(Math.random() * disponibles.length)
    const cuenta = disponibles[randomIndex]

    cuenta.assigned = true
    cuenta.assignedTo = m.sender

    if (!crunchy.users[m.sender]) crunchy.users[m.sender] = {}
    crunchy.users[m.sender].lastClaim = now

    const expiryText = cuenta.expiry
      ? new Date(cuenta.expiry).toLocaleDateString('es-ES')
      : 'No especificada'

    const mensaje = `╭┈ࠢ͜─────────────────────────\n` +
      `│ ❀ *CUENTA CRUNCHYROLL ASIGNADA*\n` +
      `├┈ࠢ͜─────────────────────────\n` +
      `│ • *Usuario:* \`${cuenta.user}\`\n` +
      `│ • *Contraseña:* \`${cuenta.pass}\`\n` +
      `│ • *Expira:* ${expiryText}\n` +
      `│ • *Detalles:* ${cuenta.description || 'Sin descripción'}\n` +
      `│\n` +
      `│ ❀ *Este mensaje se autodestruirá en 30 segundos. Copia los datos rápido.*\n` +
      `╰┈ࠢ͜─────────────────────────`

    try {
      const sentMsg = await m.reply(mensaje)
      setTimeout(async () => {
        try {
          await client.sendMessage(m.chat, { delete: sentMsg.key })
        } catch (e) {}
      }, 30000)
    } catch (e) {
      cuenta.assigned = false
      cuenta.assignedTo = null
      crunchy.users[m.sender].lastClaim = userLast
      await m.reply(`ꕥ Ocurrió un error inesperado. Intenta de nuevo.\n> Error: ${e.message}`)
    }
  }
}
