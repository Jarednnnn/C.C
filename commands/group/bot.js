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
      // Obtener el chat (para tener participants actualizados)
      const chatData = await client.getChatById(chatId)
      
      // Obtener el número real del remitente a partir de su LID
      let realNumber = null
      
      // Intentar con getContactById (método recomendado en el issue)
      if (typeof client.getContactById === 'function') {
        try {
          const contact = await client.getContactById(sender)
          // En wwebjs, contact.number es el número sin dominio
          realNumber = contact.number
          console.log('✅ getContactById exitoso, realNumber:', realNumber)
        } catch (e) {
          console.log('❌ getContactById falló, usando resolveLidToRealJid')
        }
      }
      
      // Fallback: usar resolveLidToRealJid
      if (!realNumber) {
        const realId = await resolveLidToRealJid(sender, client, chatId)
        realNumber = realId.split('@')[0]
        console.log('🔄 resolveLidToRealJid devolvió:', realNumber)
      }
      
      // Buscar en chat.participants (que usa números)
      const participant = chatData.participants.find(p => p.id.user === realNumber)
      let userIsAdmin = false
      if (participant) {
        userIsAdmin = participant.isAdmin || false
        console.log(`👤 Participante encontrado: ${participant.id.user}, isAdmin: ${participant.isAdmin}`)
      } else {
        console.log('❌ No se encontró el participante en chat.participants')
      }

      // Si no es admin, denegar
      if (!userIsAdmin) {
        return m.reply('《✧》 Solo los administradores del grupo pueden usar este comando.')
      }

      // Resto del comando (activar/desactivar bot)
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
