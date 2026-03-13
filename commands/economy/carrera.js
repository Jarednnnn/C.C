// Almacén global de timeouts
global.carreraTimeouts = global.carreraTimeouts || {}

export default {
  command: ['carrera', 'aceptarcarrera'],
  category: 'economy',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat] ||= {}
    chat.users ||= {}
    chat.retoPendiente ||= null
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const monedas = global.db.data.settings[botId].currency

    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados.\n» *${usedPrefix}economy on*`)
    }

    // --- FUNCIÓN DE RESOLUCIÓN DE JID REAL (basada en participantes del grupo) ---
    const obtenerJidReal = async (id) => {
      if (!id) return null
      // Extraemos la parte numérica (sin @ ni :)
      const simpleId = id.split('@')[0].split(':')[0]
      try {
        const metadata = await client.groupMetadata(m.chat)
        const participant = metadata.participants.find(p => 
          p.id.includes(simpleId) || (p.lid && p.lid.includes(simpleId))
        )
        // Si encontramos al participante, devolvemos su JID completo
        if (participant) return participant.id.split('@')[0] + '@s.whatsapp.net'
        // Si no, asumimos que el simpleId es el número y construimos el JID
        return simpleId + '@s.whatsapp.net'
      } catch {
        return simpleId + '@s.whatsapp.net'
      }
    }

    // =================== COMANDO #carrera ===================
    if (command === 'carrera') {
      if (chat.carreraActiva) return m.reply('ꕥ Ya hay una carrera en curso.')

      // Obtener mencionado o citado (estilo giveallharem)
      const mentionedJid = m.mentionedJid
      const rawOpponent = mentionedJid[0] || (m.quoted ? m.quoted.sender : null)
      if (!rawOpponent) return m.reply(`ꕥ Menciona a alguien.\n> Ejemplo: *${usedPrefix}carrera @usuario 200*`)

      // Resolvemos ambos a JID real
      const retador = await obtenerJidReal(m.sender)
      const oponente = await obtenerJidReal(rawOpponent)

      if (retador === oponente) return m.reply('ꕥ No puedes jugar contra ti mismo.')

      // Extraer apuesta
      let apuesta = parseInt(args.find(a => !isNaN(a.replace(/[,.]/g, '')) && parseInt(a.replace(/[,.]/g, '')) >= 100)?.replace(/[,.]/g, ''))
      if (!apuesta) return m.reply(`ꕥ Apuesta mínima: 100 ${monedas}.`)

      if (!chat.users[retador]) chat.users[retador] = { coins: 0 }
      if (chat.users[retador].coins < apuesta) return m.reply(`ꕥ No tienes suficientes ${monedas}.`)

      // Limpiar retos viejos
      if (chat.retoPendiente) {
        if (global.carreraTimeouts[m.chat]) clearTimeout(global.carreraTimeouts[m.chat])
        if (chat.retoPendiente.expiracion < Date.now()) {
          if (chat.users[chat.retoPendiente.retador]) chat.users[chat.retoPendiente.retador].coins += chat.retoPendiente.apuesta
          delete chat.retoPendiente
        } else return m.reply('ꕥ Hay un reto pendiente. Espera un momento.')
      }

      // Descontar monedas al retador y guardar reto
      chat.users[retador].coins -= apuesta
      chat.retoPendiente = { retador, oponente, apuesta, expiracion: Date.now() + 60000 }

      // Timeout de expiración
      global.carreraTimeouts[m.chat] = setTimeout(() => {
        if (chat.retoPendiente && chat.retoPendiente.retador === retador) {
          if (chat.users[retador]) chat.users[retador].coins += apuesta
          delete chat.retoPendiente
          client.sendMessage(m.chat, { text: 'ꕥ El reto ha expirado.' })
        }
      }, 60000)

      // Obtener nombres para mostrar
      const nRetador = global.db.data.users[retador]?.name || retador.split('@')[0]
      const nOponente = global.db.data.users[oponente]?.name || oponente.split('@')[0]

      // Mensaje con decoración estilo giveallharem
      const mensaje = `「✿」 *${nRetador}*, ¿confirmas retar a *${nOponente}*?\n\n❏ Apuesta: *${apuesta} ${monedas}* cada uno\n\n✐ Para aceptar escribe *${usedPrefix}aceptarcarrera*`
      await client.sendMessage(m.chat, { text: mensaje, mentions: [retador, oponente] }, { quoted: m })
    }

    // =================== COMANDO #aceptarcarrera ===================
    else if (command === 'aceptarcarrera') {
      if (!chat.retoPendiente) return m.reply('ꕥ No hay retos pendientes.')

      // Resolvemos el ID del que acepta
      const quienAcepta = await obtenerJidReal(m.sender)
      const reto = chat.retoPendiente

      // Comparación usando los números (sin @) para mayor seguridad
      if (quienAcepta.split('@')[0] !== reto.oponente.split('@')[0]) {
        // Mostramos el nombre del oponente si está disponible
        const nombreOponente = global.db.data.users[reto.oponente]?.name || reto.oponente.split('@')[0]
        return m.reply(`ꕥ Solo *${nombreOponente}* puede aceptar este reto.`)
      }

      if (reto.expiracion < Date.now()) {
        if (chat.users[reto.retador]) chat.users[reto.retador].coins += reto.apuesta
        delete chat.retoPendiente
        return m.reply('ꕥ El reto expiró.')
      }

      if (!chat.users[quienAcepta]) chat.users[quienAcepta] = { coins: 0 }
      if (chat.users[quienAcepta].coins < reto.apuesta) return m.reply(`ꕥ No tienes suficientes ${monedas}.`)

      chat.users[quienAcepta].coins -= reto.apuesta
      if (global.carreraTimeouts[m.chat]) clearTimeout(global.carreraTimeouts[m.chat])
      delete chat.retoPendiente

      await iniciarCarrera(client, m.chat, quienAcepta, reto, monedas, global.db.data)
    }
  }
}

async function iniciarCarrera(client, chatId, oponenteId, reto, monedas, dbData) {
  const chat = dbData.chats[chatId]
  const retadorId = reto.retador
  const premio = reto.apuesta * 2

  const nRetador = dbData.users[retadorId]?.name || retadorId.split('@')[0]
  const nOponente = dbData.users[oponenteId]?.name || oponenteId.split('@')[0]

  const carrera = {
    jugadores: [
      { id: retadorId, nombre: nRetador, pos: 0 },
      { id: oponenteId, nombre: nOponente, pos: 0 }
    ],
    meta: 15,
    msgId: null
  }
  chat.carreraActiva = true

  const buildPista = () => {
    return carrera.jugadores.map(j => {
      const p = j.pos >= carrera.meta ? '-'.repeat(carrera.meta) + '🐎🏁' : '-'.repeat(j.pos) + '🐎' + '-'.repeat(carrera.meta - j.pos - 1) + '🏁'
      return `❏ ${j.nombre}\n  ${p}`
    }).join('\n\n')
  }

  const { key } = await client.sendMessage(chatId, { text: `「✿」 *CARRERA INICIADA*\n\n${buildPista()}\n\n❏ Premio: *${premio} ${monedas}*` })
  carrera.msgId = key.id

  const intervalo = setInterval(async () => {
    carrera.jugadores.forEach(j => j.pos += Math.floor(Math.random() * 3) + 1)
    const ganador = carrera.jugadores.find(j => j.pos >= carrera.meta)

    if (ganador) {
      clearInterval(intervalo)
      dbData.chats[chatId].users[ganador.id].coins += premio
      const finalMsg = `「✿」 *CARRERA FINALIZADA*\n\n${buildPista()}\n\n❏ Ganador: @${ganador.id.split('@')[0]}\n❏ Premio: +${premio} ${monedas}`
      await client.sendMessage(chatId, { text: finalMsg, edit: key, mentions: [ganador.id] })
      delete chat.carreraActiva
    } else {
      await client.sendMessage(chatId, { text: `「✿」 *CARRERA*\n\n${buildPista()}\n\n❏ Premio: *${premio} ${monedas}*`, edit: key })
    }
  }, 2500)
}
