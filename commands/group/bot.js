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
      console.log('=================================')
      console.log('Comando #bot iniciado')
      console.log('Sender original:', sender)
      console.log('Chat ID:', chatId)

      const groupMetadata = await client.groupMetadata(chatId)
      console.log('Metadatos obtenidos, participantes:', groupMetadata.participants.length)

      let userIsAdmin = false
      let foundUser = false

      for (const participant of groupMetadata.participants) {
        const originalId = participant.id
        const realId = await resolveLidToRealJid(originalId, client, chatId)
        console.log(`Participante: original=${originalId}, realId=${realId}, admin=${participant.admin}`)
        
        if (realId === sender) {
          foundUser = true
          userIsAdmin = !!participant.admin
          console.log(`→ ¡Coincide con el sender! userIsAdmin=${userIsAdmin}`)
          break
        }
      }

      if (!foundUser) {
        console.log('No se encontró al sender en la lista de participantes.')
        // Intentar buscar por número sin dominio
        const senderNumber = sender.split('@')[0]
        for (const participant of groupMetadata.participants) {
          const realId = await resolveLidToRealJid(participant.id, client, chatId)
          if (realId.split('@')[0] === senderNumber) {
            foundUser = true
            userIsAdmin = !!participant.admin
            console.log(`→ Coincidencia por número! realId=${realId}, admin=${participant.admin}`)
            break
          }
        }
      }

      console.log(`Resultado final: foundUser=${foundUser}, userIsAdmin=${userIsAdmin}`)

      if (!foundUser) {
        console.log('No se pudo encontrar al usuario en el grupo.')
        return m.reply('《✧》 No se pudo verificar tu membresía en el grupo.')
      }

      if (!userIsAdmin) {
        console.log('El usuario no es admin.')
        return m.reply('《✧》 Solo los administradores del grupo pueden usar este comando.')
      }

      console.log('Usuario es admin, continuando...')

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
