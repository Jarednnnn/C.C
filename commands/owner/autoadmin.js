export default {
  command: ['autoadmin'],
  category: 'grupo',
  isOwner: true,
  botAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    const sender = m.sender
    try {
      const groupMetadata = await client.groupMetadata(m.chat)
      const participant = groupMetadata.participants.find(p => p.id === sender)
      if (participant?.admin) {
        return client.sendMessage(m.chat, { text: `Usted ya tiene admin, mi señor.`, mentions: [sender] }, { quoted: m })
      }
      await client.groupParticipantsUpdate(m.chat, [sender], 'promote')
      await client.sendMessage(m.chat, { text: `A sus órdenes, @${sender.split('@')[0]}`, mentions: [sender] }, { quoted: m })
    } catch (e) {
      await m.reply(`> Ocurrió un error al ejecutar el comando *${usedPrefix + command}*. Por favor, intente de nuevo o contacte a soporte si el problema persiste.\n> [Error: *${e.message}*]`)
    }
  }
}
