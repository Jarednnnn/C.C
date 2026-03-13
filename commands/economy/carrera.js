// Almacén global de timeouts
global.carreraTimeouts = global.carreraTimeouts || {}
import { resolveLidToRealJid } from '../../lib/utils.js'

// Extrae solo los dígitos del JID/LID para comparación robusta
const numId = (id = '') => id.replace(/[^0-9]/g, '')

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

    // Devuelve el JID real (@s.whatsapp.net) buscando en metadata del grupo
    // Si no lo encuentra, devuelve el id original
    const resolveJidFromGroup = async (targetId) => {
      try {
        const metadata = await client.groupMetadata(m.chat)
        const tNum = numId(targetId)
        const participant = metadata.participants.find(p =>
          p.id === targetId ||
          p.lid === targetId ||
          numId(p.id) === tNum ||
          numId(p.lid || '') === tNum
        )
        if (participant?.id?.endsWith('@s.whatsapp.net')) return participant.id
      } catch (e) {}
      return targetId
    }

    // =================== COMANDO #carrera ===================
    if (command === 'carrera') {
      if (chat.carreraActiva) return m.reply('ꕥ Ya hay una carrera en curso.')

      const mentionedJid = m.mentionedJid
      const rawOpponent = mentionedJid[0] || (m.quoted ? m.quoted.sender : null)
      if (!rawOpponent) return m.reply(`ꕥ Menciona a alguien.\n> Ejemplo: *${usedPrefix}carrera @usuario 200*`)

      // Resolver retador
      let retador = await resolveJidFromGroup(m.sender)

      // Resolver oponente
      let oponente = await resolveJidFromGroup(rawOpponent)
      // Si sigue sin ser JID real, intentar resolveLidToRealJid como último recurso
      if (!oponente.endsWith('@s.whatsapp.net')) {
        const resolved = await resolveLidToRealJid(rawOpponent, client, m.chat)
        if (resolved?.endsWith('@s.whatsapp.net')) oponente = resolved
      }

      if (retador === oponente) return m.reply('ꕥ No puedes jugar contra ti mismo.')

      let apuesta = parseInt(args.find(a => !isNaN(a.replace(/[,.]/g, '')) && parseInt(a.replace(/[,.]/g, '')) >= 100)?.replace(/[,.]/g, ''))
      if (!apuesta) return m.reply(`ꕥ Apuesta mínima: 100 ${monedas}.`)

      if (!chat.users[retador]) chat.users[retador] = { coins: 0 }
      if (chat.users[retador].coins < apuesta) return m.reply(`ꕥ No tienes suficientes ${monedas}.`)

      // Limpiar reto viejo si existe
      if (chat.retoPendiente) {
        if (global.carreraTimeouts[m.chat]) clearTimeout(global.carreraTimeouts[m.chat])
        if (chat.retoPendiente.expiracion < Date.now()) {
          if (chat.users[chat.retoPendiente.retador]) chat.users[chat.retoPendiente.retador].coins += chat.retoPendiente.apuesta
          delete chat.retoPendiente
        } else return m.reply('ꕥ Hay un reto pendiente. Espera un momento.')
      }

      chat.users[retador].coins -= apuesta
      chat.retoPendiente = {
        retador,                        // JID real del retador
        oponente,                       // JID real del oponente (o lo mejor que pudimos resolver)
        oponenteNum: numId(oponente),   // solo dígitos, para comparación de fallback
        rawOponente: rawOpponent,       // valor original sin resolver
        apuesta,
        expiracion: Date.now() + 60000
      }

      global.carreraTimeouts[m.chat] = setTimeout(() => {
        if (chat.retoPendiente && chat.retoPendiente.retador === retador) {
          if (chat.users[retador]) chat.users[retador].coins += apuesta
          delete chat.retoPendiente
          client.sendMessage(m.chat, { text: 'ꕥ El reto ha expirado.' })
        }
      }, 60000)

      const nRetador = global.db.data.users[retador]?.name || retador.split('@')[0]
      const nOponente = global.db.data.users[oponente]?.name || oponente.split('@')[0] || rawOpponent.split('@')[0]

      const mensaje = `「✿」 *${nRetador}*, ¿confirmas retar a *${nOponente}*?\n\n❏ Apuesta: *${apuesta} ${monedas}* cada uno\n\n✐ Para aceptar escribe *${usedPrefix}aceptarcarrera*`
      await client.sendMessage(m.chat, { text: mensaje, mentions: [retador, oponente] }, { quoted: m })
    }

    // =================== COMANDO #aceptarcarrera ===================
    else if (command === 'aceptarcarrera') {
      if (!chat.retoPendiente) return m.reply('ꕥ No hay retos pendientes.')

      // Resolver quién acepta
      const quienAcepta = await resolveJidFromGroup(m.sender)
      const reto = chat.retoPendiente

      // Comparación robusta: directo, por número, por rawOponente, o por metadata
      const esOponenteValido = async () => {
        // 1. Comparación directa de JIDs
        if (reto.oponente === quienAcepta) return true

        // 2. Comparación por número limpio (cubre LID vs JID)
        const numAcepta = numId(quienAcepta)
        if (reto.oponenteNum && reto.oponenteNum === numAcepta) return true
        if (numId(reto.rawOponente) === numAcepta) return true

        // 3. Buscar en metadata cruzando todos los campos posibles
        try {
          const metadata = await client.groupMetadata(m.chat)

          // Participante que acepta
          const pAcepta = metadata.participants.find(p =>
            p.id === quienAcepta ||
            p.lid === quienAcepta ||
            numId(p.id) === numAcepta ||
            numId(p.lid || '') === numAcepta
          )

          if (pAcepta) {
            const oponenteNum = reto.oponenteNum || numId(reto.oponente)
            if (
              pAcepta.id === reto.oponente ||
              pAcepta.lid === reto.oponente ||
              numId(pAcepta.id) === oponenteNum ||
              numId(pAcepta.lid || '') === oponenteNum ||
              pAcepta.id === reto.rawOponente ||
              pAcepta.lid === reto.rawOponente ||
              numId(pAcepta.id) === numId(reto.rawOponente) ||
              numId(pAcepta.lid || '') === numId(reto.rawOponente)
            ) return true
          }
        } catch (e) {}

        return false
      }

      if (!(await esOponenteValido())) {
        const nombreOponente =
          global.db.data.users[reto.oponente]?.name ||
          reto.oponente.split('@')[0] ||
          reto.rawOponente?.split('@')[0] ||
          reto.oponente
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
      const p = j.pos >= carrera.meta
        ? '-'.repeat(carrera.meta) + '🐎🏁'
        : '-'.repeat(j.pos) + '🐎' + '-'.repeat(carrera.meta - j.pos - 1) + '🏁'
      return `❏ ${j.nombre}\n  ${p}`
    }).join('\n\n')
  }

  const { key } = await client.sendMessage(chatId, {
    text: `「✿」 *CARRERA INICIADA*\n\n${buildPista()}\n\n❏ Premio: *${premio} ${monedas}*`
  })
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
      await client.sendMessage(chatId, {
        text: `「✿」 *CARRERA*\n\n${buildPista()}\n\n❏ Premio: *${premio} ${monedas}*`,
        edit: key
      })
    }
  }, 2500)
}
