import axios from 'axios'
import { getBuffer } from '../../lib/message.js' // Ajusta la ruta según tu estructura

// Función para detectar si es un enlace de Spotify válido (track, album, playlist)
const isSpotifyUrl = (text) => {
  return /^https?:\/\/(open\.spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+)/i.test(text)
}

// Función para buscar en Spotify por texto (primer resultado)
async function searchSpotify(query) {
  const apis = [
    { 
      api: 'Stellar', 
      endpoint: `${global.APIs.stellar.url}/search/spotify?query=${encodeURIComponent(query)}&apikey=${global.APIs.stellar.key}`,
      extractor: (res) => {
        if (res?.status && res?.data?.length) {
          const first = res.data[0]
          return {
            title: first.title,
            artist: first.artist,
            album: first.album,
            duration: first.duration,
            url: first.url,
            image: first.image || ''
          }
        }
        return null
      }
    },
    // Puedes agregar más APIs de búsqueda aquí si están disponibles
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await axios.get(endpoint, { signal: controller.signal }).then(r => r.data)
      clearTimeout(timeout)
      const result = extractor(res)
      if (result) return result
    } catch (e) {
      console.error(`Error en API ${api} para búsqueda:`, e.message)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

// Función para obtener el enlace de descarga y metadatos desde múltiples APIs
async function getSpotifyFromApis(url) {
  const apis = [
    { 
      api: 'Stellar', 
      endpoint: `${global.APIs.stellar.url}/dow/spotify?url=${encodeURIComponent(url)}&apikey=${global.APIs.stellar.key}`,
      extractor: (res) => {
        if (res?.data?.download) {
          return {
            downloadUrl: res.data.download,
            title: res.data.title,
            artist: res.data.artist,
            album: res.data.album,
            duration: res.data.duration,
            image: res.data.image
          }
        }
        return null
      }
    },
    { 
      api: 'Adonix', 
      endpoint: `${global.APIs.adonix.url}/download/spotify?apikey=${global.APIs.adonix.key}&url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (res?.data?.download) {
          return {
            downloadUrl: res.data.download,
            title: res.data.title,
            artist: res.data.artist,
            album: res.data.album,
            duration: res.data.duration,
            image: res.data.image
          }
        }
        return null
      }
    },
    { 
      api: 'Vreden', 
      endpoint: `${global.APIs.vreden.url}/api/v1/download/spotify?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (res?.result?.download?.url) {
          return {
            downloadUrl: res.result.download.url,
            title: res.result.title,
            artist: res.result.artist,
            album: res.result.album,
            duration: res.result.duration,
            image: res.result.image
          }
        }
        return null
      }
    },
    // Agrega más APIs según tengas configuradas
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await axios.get(endpoint, { signal: controller.signal }).then(r => r.data)
      clearTimeout(timeout)
      const result = extractor(res)
      if (result) return { ...result, api }
    } catch (e) {
      console.error(`Error en API ${api} para descarga:`, e.message)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

export default {
  command: ['spotify', 'music', 'spotifydl'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》 Por favor, ingresa el nombre de una canción o un enlace de Spotify.')
      }
      const text = args.join(' ')
      
      // Determinar si es enlace o búsqueda
      let url = text
      let songInfo = null
      let isUrl = isSpotifyUrl(text)
      
      if (!isUrl) {
        // Buscar por texto
        await m.reply('🔎 Buscando la canción...')
        songInfo = await searchSpotify(text)
        if (!songInfo) {
          return m.reply('《✧》 No se encontraron resultados para esa búsqueda.')
        }
        url = songInfo.url
      }

      // Obtener datos de descarga desde las APIs
      const downloadData = await getSpotifyFromApis(url)
      if (!downloadData || !downloadData.downloadUrl) {
        return m.reply('《✧》 No se pudo obtener el enlace de descarga. Intenta más tarde.')
      }

      // Usar los metadatos obtenidos (priorizar los de la descarga, si no, los de búsqueda)
      const title = downloadData.title || songInfo?.title || 'Canción'
      const artist = downloadData.artist || songInfo?.artist || 'Artista desconocido'
      const album = downloadData.album || songInfo?.album || 'Álbum desconocido'
      const duration = downloadData.duration || songInfo?.duration || '?'
      const image = downloadData.image || songInfo?.image || ''

      // Obtener buffer de la imagen para thumbnail
      let thumbBuffer = null
      if (image) {
        try {
          thumbBuffer = await getBuffer(image)
        } catch (e) {
          console.error('Error al obtener imagen:', e)
        }
      }

      // Preparar mensaje de información
      const infoMessage = `➩ *Spotify Download*

> ❖ Título › *${title}*
> ✩ Artista › *${artist}*
> ⴵ Álbum › *${album}*
> ❀ Duración › *${duration}*
> ✩ Enlace › *${url}*

_Descargando audio..._`

      // Enviar información con thumbnail
      if (thumbBuffer) {
        await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
      } else {
        await m.reply(infoMessage)
      }

      // Descargar el audio
      const audioBuffer = await getBuffer(downloadData.downloadUrl)
      await client.sendMessage(m.chat, { 
        audio: audioBuffer, 
        fileName: `${title}.mp3`, 
        mimetype: 'audio/mpeg' 
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}
