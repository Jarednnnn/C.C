// Almacén global de timeouts
global.carreraTimeouts = global.carreraTimeouts || {}
import { resolveLidToRealJid } from '../../lib/utils.js'

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

    // --- FUNCIÓN SEGURA PARA OBTENER JID REAL ---
    const obtenerJidRealSeguro = async (id, grupoId) => {
      if (!id) return null
      // Si ya es un JID válido, lo devolvemos
      if (id.endsWith('@s.whatsapp.net')) return id

      // Intentar resolver con la función de utils
      let jid = await resolveLidToRealJid(id, client, grupoId)
      // Si la resolución devolvió algo diferente al original y es JID, bien
      if (jid !== id && jid.endsWith('@s.whatsapp.net')) return jid

      // Si no, forzar búsqueda en metadata del grupo
      try {
        const metadata = await client.groupMetadata(grupoId)
        const participante = metadata.participants.find(p => {
          // Buscar por LID
          if (p.lid && p.lid === id) return true
          // Buscar por ID (que puede ser JID o LID)
          if (p.id === id) return true
          // Buscar por número de teléfono (sin @)
          const phone = id.split('@')[0].replace(/\D/g, '')
          if (p.phoneNumber && p.phoneNumber.includes(phone)) return true
          return false
        })
        if (participante) {
          // El participante puede tener id en formato JID o LID; aseguramos JID
          if (participante.id.endsWith('@s.whatsapp.net')) return participante.id
          // Si no, construir JID con el número de teléfono si existe
          if (participante.phoneNumber) {
            return participante.phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net'
          }
        }
      } catch (e) {
        console.error('Error al obtener metadata:', e)
      }
      // Último recurso: devolver el original (aunque probablemente cause error)
      return id
    }

    // --- FUNCIÓN PARA OBTENER NOMBRE LEGIBLE ---
    const obtenerNombre = (jid) => {
      if (!jid) return 'Desconocido'
      // Buscar en base de datos global
      const nombreDB = global.db.data.users[jid]?.name
      if (nombreDB) return nombreDB
      // Si es un JID, formatear el número
      const numero = jid.split('@')[0]
      // Formato internacional legible (opcional)
      return numero.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4')
    }

    // =================== COMANDO #carrera ===================
    if (command === 'carrera') {
      if (chat.carreraActiva) return m.reply('ꕥ Ya hay una carrera en curso.')

      // Obtener mencionado o citado
      const mentionedJid = m.mentionedJid
      const rawOpponent = mentionedJid?.[0] || m.quoted?.sender
      if (!rawOpponent) return m.reply(`ꕥ Menciona a alguien.\n> Ejemplo: *${usedPrefix}carrera @usuario 200*`)

      // Resolver a JID real usando la función segura
      const retador = await obtenerJidRealSeguro(m.sender, m.chat)
      const oponente = await obtenerJidRealSeguro(rawOpponent, m.chat)

      if (!oponente) return m.reply('ꕥ No se pudo identificar al oponente.')
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

      // Descontar monedas al retador y guardar reto (guardamos los JIDs reales)
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
      const nRetador = obtenerNombre(retador)
      const nOponente = obtenerNombre(oponente)

      // Mensaje con decoración
      const mensaje = `「✿」 *${nRetador}*, ¿confirmas retar a *${nOponente}*?\n\n❏ Apuesta: *${apuesta} ${monedas}* cada uno\n\n✐ Para aceptar escribe *${usedPrefix}aceptarcarrera*\n⏳ Este reto expirará en 60 segundos.`
      await client.sendMessage(m.chat, { text: mensaje, mentions: [retador, oponente] }, { quoted: m })
    }

    // =================== COMANDO #aceptarcarrera ===================
    else if (command === 'aceptarcarrera') {
      if (!chat.retoPendiente) return m.reply('ꕥ No hay retos pendientes.')

      // Resolver el ID del que acepta usando la función segura
      const quienAcepta = await obtenerJidRealSeguro(m.sender, m.chat)
      const reto = chat.retoPendiente

      // Comparar directamente los JIDs reales
      if (quienAcepta !== reto.oponente) {
        const nombreOponente = obtenerNombre(reto.oponente)
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

  // Función para obtener nombre legible (reutilizada)
  const obtenerNombre = (jid) => {
    if (!jid) return 'Desconocido'
    const nombreDB = dbData.users[jid]?.name
    if (nombreDB) return nombreDB
    const numero = jid.split('@')[0]
    return numero.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4')
  }

  const nRetador = obtenerNombre(retadorId)
  const nOponente = obtenerNombre(oponenteId)

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
