export default {
  command: 'aceptarcarrera',
  category: 'economy',
  run: async (client, m, args, usedPrefix, command) => {
    const chatId = m.chat
    const userId = m.sender
    const db = global.db.data
    const chat = db.chats[chatId] = db.chats[chatId] || {}
    const user = chat.users = chat.users || {}
    const userData = user[userId] = user[userId] || { coins: 0 }
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const botSettings = db.settings && db.settings[botId] ? db.settings[botId] : {}
    const monedas = botSettings.currency || 'coins'

    // Verificar economía activada
    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }

    // Verificar que haya un reto pendiente
    if (!chat.retoPendiente) {
      return m.reply('ꕥ No hay ningún reto de carrera pendiente en este grupo.')
    }

    const reto = chat.retoPendiente

    // Verificar que el usuario que acepta es el oponente
    if (userId !== reto.oponente) {
      const oponenteName = (db.users && db.users[reto.oponente] && db.users[reto.oponente].name) || reto.oponente.split('@')[0]
      return m.reply(`ꕥ Solo *${oponenteName}* puede aceptar este reto.`)
    }

    // Verificar que el reto no haya expirado
    if (reto.expiracion < Date.now()) {
      // Devolver fondos al retador
      if (user[reto.retador]) {
        user[reto.retador].coins += reto.apuestaRetador
      }
      delete chat.retoPendiente
      return m.reply('⏳ El reto de carrera ha expirado.')
    }

    // Verificar fondos del aceptante
    if (userData.coins < reto.apuestaRetador) {
      return m.reply(`ꕥ No tienes suficientes ${monedas} para igualar la apuesta de *${reto.apuestaRetador} ${monedas}*.`)
    }

    // Restar apuesta del aceptante
    userData.coins -= reto.apuestaRetador

    // Cancelar el timeout de expiración
    clearTimeout(reto.timeout)

    // Eliminar el reto pendiente
    delete chat.retoPendiente

    // Iniciar la carrera
    await iniciarCarrera(client, chatId, userId, reto, monedas, db)
  }
}

// Función de carrera (puede estar en el mismo archivo o en un helper)
async function iniciarCarrera(client, chatId, userIdAceptante, reto, monedas, db) {
  const chat = db.chats[chatId]
  const user = chat.users
  const retadorId = reto.retador
  const oponenteId = reto.oponente
  const apuesta = reto.apuestaRetador
  const premioTotal = apuesta * 2

  // Obtener nombres
  const nombreRetador = (db.users && db.users[retadorId] && db.users[retadorId].name) || retadorId.split('@')[0]
  const nombreOponente = (db.users && db.users[oponenteId] && db.users[oponenteId].name) || oponenteId.split('@')[0]

  const longitudMeta = 15
  let posRetador = 0
  let posOponente = 0
  let terminada = false

  const carrera = {
    jugadores: [
      { id: retadorId, nombre: nombreRetador, posicion: 0, apuesta },
      { id: oponenteId, nombre: nombreOponente, posicion: 0, apuesta }
    ],
    longitud: longitudMeta,
    mensajeId: null,
    intervalo: null,
    iniciada: Date.now()
  }
  chat.carreraActiva = carrera

  function generarPista(jugador) {
    const pos = jugador.posicion
    if (pos < longitudMeta) {
      return '-'.repeat(pos) + '🐎' + '-'.repeat(longitudMeta - pos - 1) + '🏁'
    } else {
      return '-'.repeat(longitudMeta) + '🐎'
    }
  }

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

  function mover() {
    if (terminada) return

    // Mover cada jugador de 1 a 3 posiciones
    carrera.jugadores.forEach(j => {
      if (j.posicion < longitudMeta) {
        j.posicion += Math.floor(Math.random() * 3) + 1
      }
    })

    // Verificar si alguien llegó o superó la meta
    const jugadoresLlegados = carrera.jugadores.filter(j => j.posicion >= longitudMeta)
    if (jugadoresLlegados.length > 0) {
      terminada = true
      clearInterval(carrera.intervalo)

      let ganadorId = null
      if (jugadoresLlegados.length === 1) {
        ganadorId = jugadoresLlegados[0].id
      } else {
        // Dos llegaron en el mismo turno: gana el de mayor posición, si igual empate
        if (jugadoresLlegados[0].posicion > jugadoresLlegados[1].posicion) {
          ganadorId = jugadoresLlegados[0].id
        } else if (jugadoresLlegados[1].posicion > jugadoresLlegados[0].posicion) {
          ganadorId = jugadoresLlegados[1].id
        } else {
          ganadorId = null // empate
        }
      }

      if (ganadorId) {
        // Transferir monedas al ganador
        user[ganadorId].coins += premioTotal
        const ganador = carrera.jugadores.find(j => j.id === ganadorId)
        const perdedor = carrera.jugadores.find(j => j.id !== ganadorId)
        // Construir pistas finales
        const pistaGanador = '-'.repeat(longitudMeta) + '🐎'
        let pistaPerdedor
        if (perdedor.posicion < longitudMeta) {
          pistaPerdedor = '-'.repeat(perdedor.posicion) + '🐎' + '-'.repeat(longitudMeta - perdedor.posicion - 1) + '🏁'
        } else {
          // Perdedor también llegó pero mantiene la meta según reglas
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
        user[retadorId].coins += apuesta
        user[oponenteId].coins += apuesta
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

      // Eliminar la carrera activa
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

  // Iniciar intervalo
  carrera.intervalo = setInterval(mover, 2000)
}
