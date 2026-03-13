import { resolveLidToRealJid } from "../../lib/utils.js"

global.carreraTimeouts ??= {}

export default {
  command: 'carrera',
  category: 'economy',
  run: async (client, m, args, usedPrefix) => {

    const chat = global.db.data.chats[m.chat]
    const senderReal = await resolveLidToRealJid(m.sender, client, m.chat)

    const user = chat.users[senderReal]
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const monedas = global.db.data.settings[botId].currency

    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados.`)
    }

    if (chat.carreraActiva) {
      return m.reply('ꕥ Ya hay una carrera en curso.')
    }

    let opponent = m.mentionedJid?.[0] || m.quoted?.sender
    if (!opponent) {
      return m.reply(`ꕥ Menciona a un usuario.\nEj: *${usedPrefix}carrera @usuario 200*`)
    }

    const opponentReal = await resolveLidToRealJid(opponent, client, m.chat)

    if (opponentReal === senderReal) {
      return m.reply('ꕥ No puedes retarte a ti mismo.')
    }

    let apuesta = null
    for (let arg of args) {
      let n = parseInt(arg.replace(/[,.]/g, ''))
      if (!isNaN(n) && n >= 100) {
        apuesta = n
        break
      }
    }

    if (!apuesta) {
      return m.reply(`ꕥ Apuesta inválida.`)
    }

    if (!chat.users[opponentReal]) chat.users[opponentReal] = { coins: 0 }

    if (user.coins < apuesta) {
      return m.reply(`ꕥ No tienes suficientes ${monedas}.`)
    }

    if (chat.retoPendiente) {
      return m.reply('ꕥ Ya hay un reto pendiente.')
    }

    user.coins -= apuesta

    chat.retoPendiente = {
      retador: senderReal,
      oponente: opponentReal,
      apuestaRetador: apuesta,
      expiracion: Date.now() + 60000
    }

    global.carreraTimeouts[m.chat] = setTimeout(() => {

      const reto = chat.retoPendiente
      if (!reto) return

      if (chat.users[reto.retador]) {
        chat.users[reto.retador].coins += reto.apuestaRetador
      }

      delete chat.retoPendiente
      delete global.carreraTimeouts[m.chat]

      client.sendMessage(m.chat, { text: 'ꕥ El reto expiró.' })

    }, 60000)

    const retadorName = global.db.data.users?.[senderReal]?.name || senderReal.split('@')[0]
    const oponenteName = global.db.data.users?.[opponentReal]?.name || opponentReal.split('@')[0]

    const mensaje = `╭──── CARRERA ────
🐎 ${retadorName} reta a ${oponenteName}

Apuesta: ${apuesta} ${monedas}

Para aceptar:
${usedPrefix}aceptarcarrera
╰────────────────`

    await client.sendMessage(m.chat, { text: mensaje }, { quoted: m })
  }
}
