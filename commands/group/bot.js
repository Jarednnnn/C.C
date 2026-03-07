import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: ['bot'],
  category: 'grupo',
  // isAdmin: true, // Lo manejaremos manualmente para evitar problemas con LIDs
  run: async (client, m, args) => {
    const chatId = m.chat
    const sender = m.sender

    try {
      // Verificar si el usuario es administrador del grupo
      const groupMetadata = await client.groupMetadata(chatId)
      let isAdmin = false
      for (const participant of groupMetadata.participants) {
        const realId = await resolveLidToRealJid(participant.id, client, chatId)
        if (realId === sender) {
          isAdmin = !!participant.admin
          break
        }
      }

      if (!isAdmin) {
        return m.reply('《✧》 Solo los administradores del grupo pueden usar este comando.')
      }

      const chat = global.db.data.chats[chatId]
      const estado = chat?.isBanned ?? false
      const botName = global.db.data.settings?.[client.user.id.split(':')[0] + "@s.whatsapp.net"]?.namebot || 'Bot'

      if (args[0] === 'off') {
        if (estado) return m.reply('《✧》 El *Bot* ya estaba *desactivado* en este grupo.')
        chat.isBanned = true
        return m.reply(`《✧》 Has *Desactivado* a *${botName}* en este grupo.`)
      }

      if (args[0] === 'on') {
        if (!estado) return m.reply(`《✧》 *${botName}* ya estaba *activado* en este grupo.`)
        chat.isBanned = false
        return m.reply(`《✧》 Has *Activado* a *${botName}* en este grupo.`)
      }

      return m.reply(`*✿ Estado de ${botName} (｡•́‿•̀｡)*\n✐ *Actual ›* ${estado ? '✗ Desactivado' : '✓ Activado'}\n\n✎ Puedes cambiarlo con:\n> ● _Activar ›_ *bot on*\n> ● _Desactivar ›_ *bot off*`)
    } catch (e) {
      console.error('Error en comando bot:', e)
      return m.reply(`> Ocurrió un error al ejecutar el comando. Por favor, intente de nuevo.`)
    }
  }
}
