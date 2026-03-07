import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: ['rawadmin'],
  category: 'grupo',
  run: async (client, m, args) => {
    const chatId = m.chat
    const sender = m.sender

    try {
      // Intentar forzar la recarga de metadatos de varias maneras
      await m.reply('🔍 Obteniendo metadata en bruto...')

      // 1. Usar groupMetadata sin caché si es posible
      let groupMetadata
      if (client.groupMetadata.length > 1) {
        // Algunas librerías aceptan un segundo parámetro para ignorar caché
        groupMetadata = await client.groupMetadata(chatId, true)
      } else {
        groupMetadata = await client.groupMetadata(chatId)
      }

      // 2. Mostrar la estructura raw de los participantes
      let respuesta = `📦 *RAW ADMIN DATA*\n\n`
      respuesta += `Grupo: ${groupMetadata.subject}\n`
      respuesta += `Participantes: ${groupMetadata.participants.length}\n\n`

      // Buscar específicamente al usuario
      let userFound = null
      for (const p of groupMetadata.participants) {
        const realId = await resolveLidToRealJid(p.id, client, chatId)
        if (realId === sender) {
          userFound = p
          respuesta += `⭐ *TUS DATOS (raw)*:\n`
          respuesta += `ID original: ${p.id}\n`
          respuesta += `Real ID: ${realId}\n`
          respuesta += `Admin raw: ${JSON.stringify(p.admin)}\n`
          respuesta += `Tipo de admin: ${typeof p.admin}\n`
          respuesta += `Objeto completo: ${JSON.stringify(p, null, 2)}\n\n`
          break
        }
      }

      if (!userFound) {
        respuesta += `❌ No se encontró tu ID en los participantes.\n`
      }

      // Mostrar todos los admins detectados
      const admins = groupMetadata.participants.filter(p => p.admin)
      respuesta += `👥 *Admins detectados (${admins.length}):*\n`
      admins.forEach((p, i) => {
        respuesta += `${i+1}. ${p.id} → ${p.admin}\n`
      })

      await client.sendMessage(m.chat, { text: respuesta }, { quoted: m })

    } catch (e) {
      console.error('Error en rawadmin:', e)
      m.reply(`Error: ${e.message}`)
    }
  }
}
