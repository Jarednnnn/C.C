export default {
  command: ['autoadmin'],
  category: 'grupo',
  isOwner: true,
  botAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    const sender = m.sender
    const chatId = m.chat
    try {
      // Obtener metadatos del grupo
      const groupMetadata = await client.groupMetadata(chatId)
      
      // Normalizar ID del bot (quitar :XX y asegurar dominio)
      const botIdRaw = client.user.id.split(':')[0]
      const botId = botIdRaw.includes('@') ? botIdRaw : botIdRaw + '@s.whatsapp.net'
      
      // Buscar al bot en la lista de participantes
      const botParticipant = groupMetadata.participants.find(p => 
        p.id === botId || p.id.split('@')[0] === botId.split('@')[0]
      )
      
      // Log en consola para depuración
      console.log('╭────────────────────────────···')
      console.log(`│ Grupo: ${groupMetadata.subject || 'sin nombre'} (${chatId})`)
      console.log(`│ Bot ID detectado: ${botId}`)
      console.log(`│ Bot encontrado en participantes: ${botParticipant ? 'SÍ' : 'NO'}`)
      if (botParticipant) {
        console.log(`│ Bot admin: ${botParticipant.admin ? 'SÍ' : 'NO'}`)
      } else {
        console.log(`│ IDs de algunos participantes:`, groupMetadata.participants.slice(0, 3).map(p => p.id))
      }
      console.log('╰────────────────────────────···')
      
      // Verificar que el bot sea admin
      if (!botParticipant || !botParticipant.admin) {
        console.log(`❌ El bot NO es admin en este grupo.`)
        return m.reply('《✧》 El bot no es administrador en este grupo. No puedo ejecutar el comando.')
      }
      
      console.log(`✅ El bot SÍ es admin en este grupo. Continuando...`)
      
      // Buscar al usuario que ejecuta el comando (el owner)
      const userParticipant = groupMetadata.participants.find(p => 
        p.id === sender || p.id.split('@')[0] === sender.split('@')[0]
      )
      
      if (userParticipant?.admin) {
        console.log(`ℹ️ El usuario ya es admin.`)
        return client.sendMessage(m.chat, { 
          text: `Usted ya tiene admin, mi señor.`, 
          mentions: [sender] 
        }, { quoted: m })
      }
      
      // Proceder a promover
      console.log(`🚀 Promoviendo a ${sender}...`)
      await client.groupParticipantsUpdate(m.chat, [sender], 'promote')
      
      console.log(`✅ Promoción exitosa.`)
      await client.sendMessage(m.chat, { 
        text: `A sus órdenes, @${sender.split('@')[0]}`, 
        mentions: [sender] 
      }, { quoted: m })
      
    } catch (e) {
      console.error(`❌ Error en autoadmin:`, e)
      await m.reply(`> Ocurrió un error al ejecutar el comando *${usedPrefix + command}*.\n> [Error: *${e.message}*]\n> Por favor, intente de nuevo o contacte a soporte.`)
    }
  }
}
