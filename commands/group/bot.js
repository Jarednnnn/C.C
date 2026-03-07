import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: ['bot'],
  category: 'grupo',
  run: async (client, m, args) => {
    const chat = global.db.data.chats[m.chat]
    const estado = chat.isBanned ?? false
    const sender = m.sender
    const chatId = m.chat

    try {
      const groupMetadata = await client.groupMetadata(chatId)
      let userIsAdmin = false
      let userFound = null

      for (const participant of groupMetadata.participants) {
        const realId = await resolveLidToRealJid(participant.id, client, chatId)
        if (realId === sender) {
          userFound = participant
          userIsAdmin = !!participant.admin
          break
        }
      }

      console.log('=== DEBUG BOT ===')
      console.log('Usuario:', sender)
      console.log('Participante encontrado:', userFound ? 'Sí' : 'No')
      if (userFound) {
        console.log('admin en metadata:', userFound.admin)
        console.log('admin booleano:', !!userFound.admin)
      }
      console.log('userIsAdmin:', userIsAdmin)

      if (!userFound) {
        return m.reply('No se pudo verificar tu membresía en el grupo.')
      }

      if (!userIsAdmin) {
        return m.reply('《✧》 Solo los administradores del grupo pueden usar este comando.')
      }

      if (args[0] === 'off') {
        if (estado) return m.reply('《✧》 El *Bot* ya estaba *desactivado* en este grupo.')
        chat.isBanned = true
        return m.reply(`《✧》 Has *Desactivado* a *${global.db.data.settings[client.user.id.split(':')[0] + "@s.whatsapp.net"].namebot}* en este grupo.`)
      }

      if (args[0] === 'on') {
        if (!estado) return m.reply(`《✧》 *${global.db.data.settings[client.user.id.split(':')[0] + "@s.whatsapp.net"].namebot}* ya estaba *activado* en este grupo.`)
        chat.isBanned = false
        return m.reply(`《✧》 Has *Activado* a *${global.db.data.settings[client.user.id.split(':')[0] + "@s.whatsapp.net"].namebot}* en este grupo.`)
      }

      return m.reply(`*✿ Estado de ${global.db.data.settings[client.user.id.split(':')[0] + "@s.whatsapp.net"].namebot} (｡•́‿•̀｡)*\n✐ *Actual ›* ${estado ? '✗ Desactivado' : '✓ Activado'}\n\n✎ Puedes cambiarlo con:\n> ● _Activar ›_ *bot on*\n> ● _Desactivar ›_ *bot off*`)
    } catch (e) {
      console.error('Error en comando bot:', e)
      return m.reply('Ocurrió un error al ejecutar el comando.')
    }
  }
}
