import ytsearch from 'yt-search'
import { getBuffer } from '../../lib/message.js'
import fetch from 'node-fetch'

// Función para obtener audio de múltiples APIs (copiada del script que funciona)
async function getAudioFromApis(url) {
  const apis = [
    { api: 'Adonix', endpoint: `${global.APIs.adonix.url}/download/ytaudio?apikey=${global.APIs.adonix.key}&url=${encodeURIComponent(url)}`, extractor: res => res?.data?.url },    
    { api: 'Ootaizumi', endpoint: `${global.APIs.ootaizumi.url}/downloader/youtube/play?query=${encodeURIComponent(url)}`, extractor: res => res.result?.download },
    { api: 'Vreden', endpoint: `${global.APIs.vreden.url}/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=256`, extractor: res => res.result?.download?.url },
    { api: 'Stellar', endpoint: `${global.APIs.stellar.url}/dl/ytdl?url=${encodeURIComponent(url)}&format=mp3&key=${global.APIs.stellar.key}`, extractor: res => res.result?.download },
    { api: 'Ootaizumi v2', endpoint: `${global.APIs.ootaizumi.url}/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`, extractor: res => res.result?.download },
    { api: 'Vreden v2', endpoint: `${global.APIs.vreden.url}/api/v1/download/play/audio?query=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.url },
    { api: 'Nekolabs', endpoint: `${global.APIs.nekolabs.url}/downloader/youtube/v1?url=${encodeURIComponent(url)}&format=mp3`, extractor: res => res.result?.downloadUrl },
    { api: 'Nekolabs v2', endpoint: `${global.APIs.nekolabs.url}/downloader/youtube/play/v1?q=${encodeURIComponent(url)}`, extractor: res => res.result?.downloadUrl }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
      clearTimeout(timeout)
      const link = extractor(res)
      if (link) return { url: link, api }
    } catch (e) {
      // Ignorar errores de cada API
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async (client, m, args) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }

      const text = args.join(' ')
      const searchResult = await ytsearch(text)
      if (!searchResult.videos || !searchResult.videos.length) {
        return m.reply('《✧》 No se encontró información del video.')
      }

      const video = searchResult.videos[0]

      const { title, author, timestamp: duration, views, url, image } = video
      const vistas = (views || 0).toLocaleString()
      const canal = author?.name || author || 'Desconocido'
      const thumbBuffer = await getBuffer(image)

      const caption = `➥ Descargando › ${title}

> ✿⃘࣪◌ ֪ Canal › ${canal}
> ✿⃘࣪◌ ֪ Duración › ${duration || 'Desconocido'}
> ✿⃘࣪◌ ֪ Vistas › ${vistas}
> ✿⃘࣪◌ ֪ Enlace › ${url}

𐙚 ❀ ｡ ↻ El archivo se está enviando, espera un momento... ˙𐙚`

      await client.sendMessage(m.chat, { image: thumbBuffer, caption }, { quoted: m })

      // Obtener URL de descarga usando múltiples APIs
      const audioResult = await getAudioFromApis(url)
      if (!audioResult?.url) {
        return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde.')
      }

      const audioBuffer = await getBuffer(audioResult.url)
      const mensaje = {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      }

      await client.sendMessage(m.chat, mensaje, { quoted: m })
    } catch (e) {
      await m.reply(`《✧》 Ocurrió un error inesperado al ejecutar el comando. Inténtalo de nuevo o contacta al soporte.\n> Error: ${e.message}`)
    }
  }
}
