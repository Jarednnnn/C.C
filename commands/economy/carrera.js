import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: 'carrera',
  category: 'economy',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat]
    const user = chat.users[m.sender]
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const monedas = global.db.data.settings[botId].currency

    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }

    if (chat.carreraActiva) {
      return m.reply('ꕥ Ya hay una carrera en curso en este grupo. Espera a que termine.')
    }

    // Obtener mención o quoted
    let opponentLid = m.mentionedJid?.[0]
    if (!opponentLid) {
      if (m.quoted?.sender) {
        opponentLid = m.quoted.sender
      } else {
        return m.reply(`ꕥ Debes mencionar al usuario con quien quieres competir.\n> Ejemplo: *${usedPrefix}carrera @usuario 200*`)
      }
    }

    // Resolver LID a JID real
    const opponentId = await resolveLidToRealJid(opponentLid, client, m.chat)
    if (!opponentId) {
      return m.reply('ꕥ No se pudo identificar al usuario mencionado.')
    }

    if (opponentId === m.sender) {
      return m.reply('ꕥ No puedes retarte a ti mismo. Menciona a otro usuario.')
    }

    // Buscar apuesta en args
    let apuesta = null
    for (let arg of args) {
      let limpio = arg.replace(/[,.]/g, '')
      let num = parseInt(limpio)
      if (!isNaN(num) && num >= 100) {
        apuesta = num
        break
      }
    }
    if (apuesta === null) {
      return m.reply(`ꕥ Apuesta inválida. Debe ser un número mayor o igual a 100 ${monedas}.`)
    }

    // Inicializar oponente si no existe
    if (!chat.users[opponentId]) chat.users[opponentId] = { coins: 0 }

    if (user.coins < apuesta) {
      return m.reply(`ꕥ No tienes suficientes ${monedas}. Necesitas *${apuesta} ${monedas}*.`)
    }

    // Limpiar reto expirado previo
    if (chat.retoPendiente) {
      if (chat.retoPendiente.expiracion < Date.now()) {
        const retadorAnterior = chat.retoPendiente.retador
        if (retadorAnterior && chat.users[retadorAnterior]) {
          chat.users[retadorAnterior].coins += chat.retoPendiente.apuestaRetador
        }
        delete chat.retoPendiente
      } else {
        return m.reply('ꕥ Ya hay un reto pendiente en este grupo. Espera a que sea aceptado o expire.')
      }
    }

    user.coins -= apuesta

    const reto = {
      retador: m.sender,
      oponente: opponentId,
      apuestaRetador: apuesta,
      expiracion: Date.now() + 60000
    }
    chat.retoPendiente = reto

    const timeout = setTimeout(() => {
      if (chat.retoPendiente && chat.retoPendiente.retador === m.sender) {
        if (chat.users[m.sender]) {
          chat.users[m.sender].coins += apuesta
        }
        delete chat.retoPendiente
        client.sendMessage(m.chat, { text: 'ꕥ El reto de carrera ha expirado por falta de respuesta.' })
      }
    }, 60000)
    chat.retoPendiente.timeout = timeout

    const retadorName = global.db.data.users?.[m.sender]?.name || m.sender.split('@')[0]
    const oponenteName = global.db.data.users?.[opponentId]?.name || opponentId.split('@')[0]

    const mensajeReto = `╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─݊͜┅ࠡ͜͜┈࠭͜
│        𐔌 RETO DE CARRERA 𐦯
│
│ 🐎 *${retadorName}* reta a *${oponenteName}*
│
│ Apuesta: *${apuesta} ${monedas}* cada uno
│
│ Para aceptar, escribe:
│ *${usedPrefix}aceptarcarrera*
│
│ Este reto expirará en 60 segundos.
╰┈ࠢ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜┈ࠢ͜╯`
    await client.sendMessage(m.chat, { text: mensajeReto }, { quoted: m })
  }
}
