import { resolveLidToRealJid } from "../../lib/utils.js"

export default {
  command: 'aceptarcarrera',
  category: 'economy',
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data.chats[m.chat]
    const user = chat.users[m.sender]
    const botId = client.user.id.split(':')[0] + '@s.whatsapp.net'
    const monedas = global.db.data.settings[botId].currency

    if (chat.adminonly || !chat.economy) {
      return m.reply(`ꕥ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }

    // Verificar que hay un reto pendiente
    if (!chat.retoPendiente) {
      return m.reply('ꕥ No hay ningún reto de carrera pendiente en este grupo.')
    }

    const reto = chat.retoPendiente

    // Obtener el JID real del usuario que ejecuta el comando
    const senderReal = await resolveLidToRealJid(m.sender, client, m.chat)
    console.log('=== DEBUG ACEPTARCARRERA ===')
    console.log('m.sender original:', m.sender)
    console.log('senderReal después de resolveLidToRealJid:', senderReal)
    console.log('reto.oponente guardado:', reto.oponente)
    console.log('senderNum (split):', senderReal.split('@')[0])
    console.log('oponenteNum (split):', reto.oponente.split('@')[0])

    // Extraer solo la parte numérica
    const senderNum = senderReal.split('@')[0]
    const oponenteNum = reto.oponente.split('@')[0]

    if (senderNum !== oponenteNum) {
      const oponenteName = global.db.data.users?.[reto.oponente]?.name || oponenteNum
      console.log('❌ No coinciden: se esperaba', oponenteNum, 'pero se recibió', senderNum)
      return m.reply(`ꕥ Solo *${oponenteName}* puede aceptar este reto.`)
    }

    console.log('✅ Coinciden, continuando...')

    // Verificar expiración
    if (reto.expiracion < Date.now()) {
      if (chat.users[reto.retador]) {
        chat.users[reto.retador].coins += reto.apuestaRetador
      }
      delete chat.retoPendiente
      return m.reply('ꕥ El reto de carrera ha expirado.')
    }

    if (user.coins < reto.apuestaRetador) {
      return m.reply(`ꕥ No tienes suficientes ${monedas} para igualar la apuesta de *${reto.apuestaRetador} ${monedas}*.`)
    }

    user.coins -= reto.apuestaRetador
    clearTimeout(reto.timeout)
    delete chat.retoPendiente

    await iniciarCarrera(client, m.chat, m.sender, reto, monedas, global.db.data)
  }
}

async function iniciarCarrera(client, chatId, userIdAceptante, reto, monedas, dbData) {
  const chat = dbData.chats[chatId]
  const users = chat.users
  const retadorId = reto.retador
  const oponenteId = reto.oponente
  const apuesta = reto.apuestaRetador
  const premioTotal = apuesta * 2

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

    carrera.jugadores.forEach(j => {
      if (j.posicion < longitudMeta) {
        j.posicion += Math.floor(Math.random() * 3) + 1
      }
    })

    const jugadoresLlegados = carrera.jugadores.filter(j => j.posicion >= longitudMeta)
    if (jugadoresLlegados.length > 0) {
      terminada = true
      clearInterval(carrera.intervalo)

      let ganadorId = null
      if (jugadoresLlegados.length === 1) {
        ganadorId = jugadoresLlegados[0].id
      } else {
        if (jugadoresLlegados[0].posicion > jugadoresLlegados[1].posicion) {
          ganadorId = jugadoresLlegados[0].id
        } else if (jugadoresLlegados[1].posicion > jugadoresLlegados[0].posicion) {
          ganadorId = jugadoresLlegados[1].id
        }
      }

      if (ganadorId) {
        users[ganadorId].coins += premioTotal
        const ganador = carrera.jugadores.find(j => j.id === ganadorId)
        const perdedor = carrera.jugadores.find(j => j.id !== ganadorId)

        const pistaGanador = '-'.repeat(longitudMeta) + '🐎'
        let pistaPerdedor
        if (perdedor.posicion < longitudMeta) {
          pistaPerdedor = '-'.repeat(perdedor.posicion) + '🐎' + '-'.repeat(longitudMeta - perdedor.posicion - 1) + '🏁'
        } else {
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
      const nuevoTexto = construirMensajeCarrera()
      client.sendMessage(chatId, { text: nuevoTexto, edit: carrera.mensajeId })
    }
  }

  const msgInicial = await client.sendMessage(chatId, { text: construirMensajeCarrera() })
  carrera.mensajeId = msgInicial.key.id
  carrera.intervalo = setInterval(mover, 2000)
}
