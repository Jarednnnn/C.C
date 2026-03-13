import { resolveLidToRealJid } from "../../lib/utils.js"

global.carreraIntervalos ??= {}

export default {
  command: 'aceptarcarrera',
  category: 'economy',
  run: async (client, m) => {

    const chat = global.db.data.chats[m.chat]

    const senderReal = await resolveLidToRealJid(m.sender, client, m.chat)

    if (!chat.retoPendiente) {
      return m.reply('ꕥ No hay ningún reto pendiente.')
    }

    const reto = chat.retoPendiente

    if (senderReal !== reto.oponente) {
      return m.reply(`ꕥ Solo ${reto.oponente.split('@')[0]} puede aceptar.`)
    }

    const user = chat.users[senderReal]

    if (user.coins < reto.apuestaRetador) {
      return m.reply('ꕥ No tienes suficientes monedas.')
    }

    user.coins -= reto.apuestaRetador

    if (global.carreraTimeouts?.[m.chat]) {
      clearTimeout(global.carreraTimeouts[m.chat])
      delete global.carreraTimeouts[m.chat]
    }

    delete chat.retoPendiente

    await iniciarCarrera(client, m.chat, reto)
  }
}

async function iniciarCarrera(client, chatId, reto) {

  const chat = global.db.data.chats[chatId]
  const users = chat.users

  const longitudMeta = 15
  const apuesta = reto.apuestaRetador
  const premioTotal = apuesta * 2

  const jugadores = [
    { id: reto.retador, pos: 0 },
    { id: reto.oponente, pos: 0 }
  ]

  function pista(p) {
    if (p < longitudMeta) {
      return '-'.repeat(p) + '🐎' + '-'.repeat(longitudMeta - p - 1) + '🏁'
    }
    return '-'.repeat(longitudMeta) + '🐎'
  }

  function render() {

    return `🏁 CARRERA

🐎 ${jugadores[0].id.split('@')[0]}
${pista(jugadores[0].pos)}

🐎 ${jugadores[1].id.split('@')[0]}
${pista(jugadores[1].pos)}

Premio: ${premioTotal}`
  }

  const msg = await client.sendMessage(chatId, { text: render() })

  global.carreraIntervalos[chatId] = setInterval(() => {

    jugadores.forEach(j => {
      if (j.pos < longitudMeta) {
        j.pos += Math.floor(Math.random()*3)+1
      }
    })

    const ganador = jugadores.find(j => j.pos >= longitudMeta)

    if (ganador) {

      clearInterval(global.carreraIntervalos[chatId])
      delete global.carreraIntervalos[chatId]

      users[ganador.id].coins += premioTotal

      client.sendMessage(chatId,{
        text:`🏆 Ganador: @${ganador.id.split('@')[0]}
Premio: ${premioTotal}`,
        edit: msg.key.id,
        mentions:[ganador.id]
      })

      return
    }

    client.sendMessage(chatId,{text:render(),edit:msg.key.id})

  },2000)
}
