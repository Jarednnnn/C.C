import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: ['debugadmin'],
  category: 'grupo',
  run: async (client, m, args) => {
    const sender = m.sender
    const chatId = m.chat

    try {
      const groupMetadata = await client.groupMetadata(chatId)
      
      let respuesta = `🔍 *DEBUG ADMIN*\n`
      respuesta += `• Tu ID: ${sender}\n`
      respuesta += `• Grupo: ${groupMetadata.subject}\n`
      respuesta += `• Participantes: ${groupMetadata.participants.length}\n\n`
      respuesta += `*Lista de participantes:*\n`

      for (const participant of groupMetadata.participants) {
        const realId = await resolveLidToRealJid(participant.id, client, chatId)
        const esTu = realId === sender ? '⭐ TÚ' : ''
        const adminStatus = participant.admin ? `✅ ${participant.admin}` : '❌ No admin'
        respuesta += `- ID original: ${participant.id}\n  Real ID: ${realId}\n  Admin: ${adminStatus} ${esTu}\n\n`
      }

      // Buscar específicamente tu ID
      const tuParticipante = groupMetadata.participants.find(p => 
        p.id === sender || p.id.split('@')[0] === sender.split('@')[0]
      )

      if (tuParticipante) {
        respuesta += `\n📌 *RESUMEN:*\n`
        respuesta += `Encontrado como: ${tuParticipante.id}\n`
        respuesta += `Admin según metadata: ${tuParticipante.admin || 'null'}\n`
        respuesta += `¿Eres admin? ${tuParticipante.admin ? 'SÍ' : 'NO (según la API)'}`
      } else {
        respuesta += `\n❌ No se encontró tu ID en los participantes.`
      }

      await client.sendMessage(m.chat, { text: respuesta }, { quoted: m })

    } catch (e) {
      console.error('Error en debugadmin:', e)
      m.reply(`Error: ${e.message}`)
    }
  }
}
