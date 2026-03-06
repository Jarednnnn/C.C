import yts from 'yt-search'
import fetch from 'node-fetch'
import { getBuffer } from '../../lib/message.js'
import ytdl from 'ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tmpDir = path.join(__dirname, '../../tmp')

// Crear carpeta tmp si no existe
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

export default {
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'], // Ajusta según tu comando de audio
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }
      const text = args.join(' ')
      const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
      const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text
      let url = query, title = null, thumbBuffer = null
      try {
        const search = await yts(query)
        if (search.all.length) {
          const videoInfo = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
          if (videoInfo) {
            url = videoInfo.url
            title = videoInfo.title
            thumbBuffer = await getBuffer(videoInfo.image)
            const vistas = (videoInfo.views || 0).toLocaleString()
            const canal = videoInfo.author?.name || 'Desconocido'
            const infoMessage = `➩ Descargando › *${title}*

> ❖ Canal › *${canal}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${vistas}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`
            await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
          }
        }
      } catch (err) {
        // Ignorar error de búsqueda
      }

      // Intentar con APIs externas
      let video = await getVideoFromApis(url)

      // Si las APIs fallan, usar ytdl-core como fallback
      if (!video?.url) {
        console.log('API falló, usando ytdl-core como fallback')
        video = await downloadWithYtdl(url)
        if (!video?.url) {
          return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde.')
        }
      }

      // Obtener buffer (acepta tanto URL como data URL)
      const audioBuffer = await getBuffer(video.url)

      // Enviar audio
      await client.sendMessage(m.chat, { 
        audio: audioBuffer, 
        mimetype: 'audio/mpeg',
        fileName: `${title || 'audio'}.mp3`
      }, { quoted: m })

    } catch (e) {
      console.error('Error en comando:', e)
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

// ========== FUNCIONES AUXILIARES ==========

async function getVideoFromApis(url) {
  const apis = [
    { api: 'Adonix', endpoint: `${global.APIs.adonix.url}/download/ytvideo?apikey=${global.APIs.adonix.key}&url=${encodeURIComponent(url)}`, extractor: res => res?.data?.url },    
    { api: 'Vreden', endpoint: `${global.APIs.vreden.url}/api/v1/download/youtube/video?url=${encodeURIComponent(url)}&quality=360`, extractor: res => res.result?.download?.url },
    { api: 'Stellar', endpoint: `${global.APIs.stellar.url}/dl/ytdl?url=${encodeURIComponent(url)}&format=mp4&key=${global.APIs.stellar.key}`, extractor: res => res.result?.download },
    { api: 'Nekolabs', endpoint: `${global.APIs.nekolabs.url}/downloader/youtube/v1?url=${encodeURIComponent(url)}&format=360`, extractor: res => res.result?.downloadUrl },
    { api: 'Vreden v2', endpoint: `${global.APIs.vreden.url}/api/v1/download/play/video?query=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.url }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
      clearTimeout(timeout)
      const link = extractor(res)
      if (link) return { url: link, api }
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

// ========== FALLBACK CON YTDL-CORE (AUDIO MP3) ==========
async function downloadWithYtdl(url) {
  try {
    // Validar que sea una URL de YouTube válida
    if (!ytdl.validateURL(url)) {
      console.log('URL no válida para ytdl-core')
      return null
    }

    // Obtener información del video
    const info = await ytdl.getInfo(url)
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '') // limpiar nombre

    // Elegir formato de audio (calidad baja para menor tamaño)
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'lowestaudio',
      filter: 'audioonly'
    })

    if (!format) {
      console.log('No se encontró formato de audio')
      return null
    }

    // Archivo temporal
    const fileName = `yt_fallback_${Date.now()}.mp3`
    const filePath = path.join(tmpDir, fileName)

    // Descargar y convertir a MP3 con ffmpeg
    await new Promise((resolve, reject) => {
      const stream = ytdl(url, { format })
      ffmpeg(stream)
        .audioBitrate(128)            // calidad aceptable
        .toFormat('mp3')
        .on('end', resolve)
        .on('error', reject)
        .save(filePath)
    })

    // Verificar tamaño (máximo 100MB)
    const stats = fs.statSync(filePath)
    const fileSizeMB = stats.size / (1024 * 1024)
    if (fileSizeMB > 100) {
      fs.unlinkSync(filePath)
      console.log('Audio demasiado grande (>100MB)')
      return null
    }

    // Leer archivo y eliminarlo
    const buffer = fs.readFileSync(filePath)
    fs.unlinkSync(filePath)

    // Convertir buffer a data URL (para que getBuffer lo entienda)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:audio/mpeg;base64,${base64}`

    return { 
      url: dataUrl,
      api: 'ytdl-core (fallback)' 
    }
  } catch (err) {
    console.error('Error en ytdl-core:', err)
    return null
  }
}
