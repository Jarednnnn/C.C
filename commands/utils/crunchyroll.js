import { cuentasCrunchyroll } from './cuentas.js' // <-- Importa las cuentas

export default {
  command: ['cuenta', 'crunchyroll'],
  category: 'gacha',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat]
    
    // Inicializar estructura si no existe
    if (!chat.crunchyroll) {
      chat.crunchyroll = {
        accounts: [], // Aquí se cargarán las cuentas desde cuentas_db.js
        users: {}     // Registro de reclamos por usuario
      }
    }

    // =============================================
    // CARGAR CUENTAS DESDE EL ARCHIVO EXTERNO
    // (solo la primera vez que se ejecuta el comando en el grupo)
    // =============================================
    if (chat.crunchyroll.accounts.length === 0) {
      // Copiar las cuentas y agregarles los campos de control
      chat.crunchyroll.accounts = cuentasCrunchyroll.map(cuenta => ({
        ...cuenta,
        assigned: false,
        assignedTo: null
      }))
      console.log(`✅ Cuentas de Crunchyroll cargadas en el grupo ${m.chat}`)
    }

    const crunchy = chat.crunchyroll

    // =============================================
    // VERIFICAR COOLDOWN (24 horas = 86400000 ms)
    // =============================================
    const cooldown = 86400000 // 24 horas
    const now = Date.now()
    const userLast = crunchy.users[m.sender]?.lastClaim || 0
    
    if (now - userLast < cooldown) {
      const remaining = cooldown - (now - userLast)
      const hours = Math.floor(remaining / 3600000)
      const minutes = Math.floor((remaining % 3600000) / 60000)
      return m.reply(`ꕥ Debes esperar *${hours}h ${minutes}m* antes de reclamar otra cuenta.`)
    }

    // =============================================
    // BUSCAR CUENTA DISPONIBLE
    // =============================================
    const disponibles = crunchy.accounts.filter(acc => !acc.assigned)
    if (disponibles.length === 0) {
      return m.reply(`ꕥ No hay cuentas de *Crunchyroll* disponibles en este momento.`)
    }

    // Seleccionar cuenta aleatoria
    const randomIndex = Math.floor(Math.random() * disponibles.length)
    const cuenta = disponibles[randomIndex]

    // Marcar como asignada
    cuenta.assigned = true
    cuenta.assignedTo = m.sender

    // Guardar timestamp del reclamo
    if (!crunchy.users[m.sender]) crunchy.users[m.sender] = {}
    crunchy.users[m.sender].lastClaim = now

    // =============================================
    // PREPARAR MENSAJE CON AUTODESTRUCCIÓN
    // =============================================
    const expiryText = cuenta.expiry 
      ? new Date(cuenta.expiry).toLocaleDateString('es-ES') 
      : 'No especificada'
    
    const mensaje = `❀ *Cuenta Crunchyroll asignada* ❀\n\n` +
      `• *Usuario:* \`${cuenta.user}\`\n` +
      `• *Contraseña:* \`${cuenta.pass}\`\n` +
      `• *Expira:* ${expiryText}\n` +
      `• *Detalles:* ${cuenta.description || 'Sin descripción'}\n\n` +
      `⚠️ *Este mensaje se autodestruirá en 30 segundos. Copia los datos rápido.*`

    try {
      const sentMsg = await m.reply(mensaje)
      
      // Autodestrucción a los 30 segundos
      setTimeout(async () => {
        try {
          await client.sendMessage(m.chat, { delete: sentMsg.key })
        } catch (e) {
          console.error('Error al eliminar mensaje:', e)
        }
      }, 30000)
      
    } catch (e) {
      // Revertir asignación si falla el envío
      cuenta.assigned = false
      cuenta.assignedTo = null
      crunchy.users[m.sender].lastClaim = userLast
      await m.reply(`ꕥ Ocurrió un error inesperado. Intenta de nuevo.\n> Error: ${e.message}`)
    }
  }
}
