export default {
  command: ['auoadmin'],
  isOwner: true,
  run: async (client, m, args, usedPrefix, command) => {
    const sender = m.sender
    await client.sendMessage(m.chat, { text: `A sus órdenes, @${sender.split('@')[0]}`, mentions: [sender] }, { quoted: m })
  }
}
