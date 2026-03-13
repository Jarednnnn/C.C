import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: ['carrera', 'aceptarcarrera'],
  category: 'economy',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat]
    const user = chat.users[m.sender]
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const monedas = global.db.data.settings[botId].currency

    // Verificar economía activada
    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }

    // =================== COMANDO #carrera ===================
    if (command === 'carrera') {
      // Verificar que no haya carrera activa
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

      // Verificar fondos del retador
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

      // Restar apuesta al retador
      user.coins -= apuesta

      // Crear reto pendiente
      const reto = {
        retador: m.sender,
        oponente: opponentId,
        apuestaRetador: apuesta,
        expiracion: Date.now() + 60000 // 60 segundos
      }
      chat.retoPendiente = reto

      // Programar expiración
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

      // Obtener nombres
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

    // =================== COMANDO #aceptarcarrera ===================
    else if (command === 'aceptarcarrera') {
      // Verificar que hay un reto pendiente
      if (!chat.retoPendiente) {
        return m.reply('ꕥ No hay ningún reto de carrera pendiente en este grupo.')
      }

      const reto = chat.retoPendiente

      // Extraer solo la parte numérica del sender y del oponente
      const senderNum = m.sender.split('@')[0]
      const oponenteNum = reto.oponente.split('@')[0]

      // Comparar por número (ignorando posibles sufijos como :10)
      if (senderNum !== oponenteNum) {
        const oponenteName = global.db.data.users?.[reto.oponente]?.name || oponenteNum
        return m.reply(`ꕥ Solo *${oponenteName}* puede aceptar este reto.`)
      }

      // Verificar expiración
      if (reto.expiracion < Date.now()) {
        // Devolver fondos al retador
        if (chat.users[reto.retador]) {
          chat.users[reto.retador].coins += reto.apuestaRetador
        }
        delete chat.retoPendiente
        return m.reply('ꕥ El reto de carrera ha expirado.')
      }

      // Verificar fondos del aceptante
      if (user.coins < reto.apuestaRetador) {
        return m.reply(`ꕥ No tienes suficientes ${monedas} para igualar la apuesta de *${reto.apuestaRetador} ${monedas}*.`)
      }

      // Restar apuesta del aceptante
      user.coins -= reto.apuestaRetador

      // Cancelar timeout de expiración
      clearTimeout(reto.timeout)

      // Eliminar reto pendiente
      delete chat.retoPendiente

      // Iniciar la carrera
      await iniciarCarrera(client, m.chat, m.sender, reto, monedas, global.db.data)
    }
  }
}

/**
 * Función que inicia la carrera
 */
async function iniciarCarrera(client, chatId, userIdAceptante, reto, monedas, dbData) {
  const chat = dbData.chats[chatId]
  const users = chat.users
  const retadorId = reto.retador
  const oponenteId = reto.oponente
  const apuesta = reto.apuestaRetador
  const premioTotal = apuesta * 2

  // Obtener nombres
  const nombreRetador = dbData.users?.[retadorId]?.name || retadorId.split('@')[0]
  const nombreOponente = dbData.users?.[oponenteId]?.name || oponenteId.split('@')[0]

  const longitudMeta = 15
  let terminada = false

  const carrera = {
    jugadores: [
      { id: retadorId, nombre: nombreRetador, posicion: 0 },
      { id: oponenteId, nombre: nombreOponente, posicion: 0 }
    ],
    longitud: longitudMeta,
    mensajeId: null,
    intervalo: null,
    iniciada: Date.now()
  }
  chat.carreraActiva = carrera

  // Generar pista individual
  function generarPista(jugador) {
    const pos = jugador.posicion
    if (pos < longitudMeta) {
      return '-'.repeat(pos) + '🐎' + '-'.repeat(longitudMeta - pos - 1) + '🏁'
    } else {
      return '-'.repeat(longitudMeta) + '🐎'
    }
  }

  // Construir mensaje completo de la carrera
  function construirMensajeCarrera() {
    const pistaRetador = generarPista(carrera.jugadores[0])
    const pistaOponente = generarPista(carrera.jugadores[1])
    return `╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─݊͜┅ࠡ͜͜┈࠭͜
│        𐔌 CARRERA 𐦯
│
│ 🐎 ${carrera.jugadores[0].nombre}
│ ${pistaRetador}
│
│ 🐎 ${carrera.jugadores[1].nombre}
│ ${pistaOponente}
│
│ El primero en llegar gana *${premioTotal} ${monedas}*
╰┈ࠢ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜┈ࠢ͜╯`
  }

  // Movimiento cada 2 segundos
  function mover() {
    if (terminada) return

    // Mover cada jugador 1-3 posiciones
    carrera.jugadores.forEach(j => {
      if (j.posicion < longitudMeta) {
        j.posicion += Math.floor(Math.random() * 3) + 1
      }
    })

    // Verificar si alguien llegó
    const jugadoresLlegados = carrera.jugadores.filter(j => j.posicion >= longitudMeta)
    if (jugadoresLlegados.length > 0) {
      terminada = true
      clearInterval(carrera.intervalo)

      let ganadorId = null
      if (jugadoresLlegados.length === 1) {
        ganadorId = jugadoresLlegados[0].id
      } else {
        // Dos llegaron: gana el de mayor posición
        if (jugadoresLlegados[0].posicion > jugadoresLlegados[1].posicion) {
          ganadorId = jugadoresLlegados[0].id
        } else if (jugadoresLlegados[1].posicion > jugadoresLlegados[0].posicion) {
          ganadorId = jugadoresLlegados[1].id
        } // si es empate, ganadorId queda null
      }

      if (ganadorId) {
        // Transferir premio
        users[ganadorId].coins += premioTotal
        const ganador = carrera.jugadores.find(j => j.id === ganadorId)
        const perdedor = carrera.jugadores.find(j => j.id !== ganadorId)

        // Pistas finales
        const pistaGanador = '-'.repeat(longitudMeta) + '🐎'
        let pistaPerdedor
        if (perdedor.posicion < longitudMeta) {
          pistaPerdedor = '-'.repeat(perdedor.posicion) + '🐎' + '-'.repeat(longitudMeta - perdedor.posicion - 1) + '🏁'
        } else {
          // Perdedor también llegó pero mantiene la meta
          pistaPerdedor = '-'.repeat(longitudMeta) + '🐎🏁'
        }

        const mensajeFinal = `╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─݊͜┅ࠡ͜͜┈࠭͜
│        𐔌 CARRERA FINALIZADA 𐦯
│
│ 🐎 ${ganador.nombre}
│ ${pistaGanador}
│
│ 🐎 ${perdedor.nombre}
│ ${pistaPerdedor}
│
│ *Ganador:* @${ganadorId.split('@')[0]}
│ *Premio:* +${premioTotal} ${monedas}
╰┈ࠢ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜┈ࠢ͜╯`
        client.sendMessage(chatId, { text: mensajeFinal, edit: carrera.mensajeId, mentions: [ganadorId] })
      } else {
        // Empate: devolver apuestas
        users[retadorId].coins += apuesta
        users[oponenteId].coins += apuesta
        const mensajeEmpate = `╭┈ࠢ͜┅ࠦ͜͜╾݊͜─ׄ͜─֬͜─֟͜─֫͜─ׄ͜─݊͜┅ࠡ͜͜┈࠭͜
│        𐔌 CARRERA FINALIZADA 𐦯
│
│ 🐎 ${nombreRetador}
│ ${'-'.repeat(longitudMeta)}🐎
│
│ 🐎 ${nombreOponente}
│ ${'-'.repeat(longitudMeta)}🐎
│
│ *¡Empate!* Se devuelven las apuestas.
╰┈ࠢ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜─ׄ͜┈ࠢ͜╯`
        client.sendMessage(chatId, { text: mensajeEmpate, edit: carrera.mensajeId })
      }

      delete chat.carreraActiva
    } else {
      // Actualizar mensaje
      const nuevoTexto = construirMensajeCarrera()
      client.sendMessage(chatId, { text: nuevoTexto, edit: carrera.mensajeId })
    }
  }

  // Enviar mensaje inicial
  const msgInicial = await client.sendMessage(chatId, { text: construirMensajeCarrera() })
  carrera.mensajeId = msgInicial.key.id
  carrera.intervalo = setInterval(mover, 2000)
}
