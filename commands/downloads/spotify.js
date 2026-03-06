import axios from 'axios'
import { getBuffer } from '../../lib/message.js'

// Expresión regular para detectar URLs de Spotify
const spotifyTrackRegex = /^https?:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/
const spotifyUrlRegex = /^https?:\/\/open\.spotify\.com\//

export default {
  command: ['spotify2', 'spdescargar', 'spotifydl', 'musica'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》 Por favor, menciona el nombre de la canción o el enlace de Spotify que deseas descargar.\n\n> Ejemplo:\n> *' + usedPrefix + command + '* Good Feeling - Flo Rida\n> *' + usedPrefix + command + '* https://open.spotify.com/track/3CLSHJv5aUROAN2vfOyCOh')
      }

      const text = args.join(' ')
      const isUrl = spotifyUrlRegex.test(text)
      let songInfo = null
      let thumbBuffer = null

      // PASO 1: OBTENER INFORMACIÓN DE LA CANCIÓN
      if (isUrl) {
        // Es un enlace directo - extraemos el ID y obtenemos info (podemos usar la misma API de zylalabs para info, pero no devuelve duración, etc.)
        // Alternativa: usar la API de zylalabs directamente para obtener info (la respuesta ya trae artist, title, album, cover)
        // Pero como zylalabs requiere API key, podemos usar otras APIs gratuitas para info.
        songInfo = await getSongInfoFromUrl(text)
      } else {
        // Es una búsqueda por texto
        songInfo = await searchSpotifySong(text)
      }

      if (!songInfo) {
        return m.reply('《✧》 No se encontraron resultados para tu búsqueda. Intenta con otro término o verifica el enlace.')
      }

      // Obtener thumbnail
      if (songInfo.image) {
        try {
          thumbBuffer = await getBuffer(songInfo.image)
        } catch (e) {
          thumbBuffer = null
        }
      }

      // Preparar mensaje de información (estilo playmp4)
      const infoMessage = `➩ *Spotify Downloader*

> ❖ *Título:* ${songInfo.title || 'Desconocido'}
> ⴵ *Artista:* ${songInfo.artist || songInfo.artists?.join(', ') || 'Desconocido'}
> ❀ *Álbum:* ${songInfo.album || 'Desconocido'}
> ✩ *Duración:* ${songInfo.duration || songInfo.durationLabel || 'Desconocido'}
> ❒ *Reproducciones:* ${songInfo.plays ? songInfo.plays.toLocaleString() : 'N/A'}
> ✪ *Enlace:* ${songInfo.url || text}

> _Descargando audio... espera un momento_`

      await client.sendMessage(m.chat, { 
        image: thumbBuffer || 'https://i.scdn.co/image/ab67616d0000b273d3e7a2e5c7e1f3c8c9d8b7a6', 
        caption: infoMessage 
      }, { quoted: m })

      // PASO 2: DESCARGAR EL AUDIO (usando múltiples APIs, priorizando zylalabs si es URL)
      const audio = await downloadSpotifyAudio(songInfo.url || text, isUrl)
      
      if (!audio?.url) {
        return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde con otro enlace o término.')
      }

      // Enviar el audio
      const audioBuffer = await getBuffer(audio.url)
      await client.sendMessage(m.chat, { 
        audio: audioBuffer, 
        fileName: `${songInfo.title || 'spotify'}.mp3`, 
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted: m })

    } catch (e) {
      console.error('Error en comando spotify2:', e)
      await m.reply(`> Ocurrió un error inesperado al ejecutar el comando *${usedPrefix + command}*. Por favor, intenta nuevamente o contacta al soporte.\n> [Error: *${e.message}*]`)
    }
  }
}

// Función para buscar canciones por texto (usa múltiples APIs gratuitas)
async function searchSpotifySong(query) {
  const apis = [
    // API 1: Stellar (la que usabas antes)
    { 
      name: 'Stellar', 
      endpoint: `${global.APIs?.stellar?.url || 'https://api.stellarapi.com'}/search/spotify?query=${encodeURIComponent(query)}&apikey=${global.APIs?.stellar?.key || ''}`,
      extractor: (res) => {
        if (!res.data?.length) return null
        const track = res.data[0]
        return {
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          url: track.url,
          image: track.image,
          plays: track.plays || track.popularity
        }
      }
    },
    
    // API 2: Vreden (gratuita)
    { 
      name: 'Vreden', 
      endpoint: `https://vreden-api.vercel.app/api/search/spotify?query=${encodeURIComponent(query)}`,
      extractor: (res) => {
        if (!res.result?.tracks?.items?.length) return null
        const track = res.result.tracks.items[0]
        return {
          title: track.name,
          artist: track.artists?.map(a => a.name).join(', '),
          album: track.album?.name,
          duration: formatDuration(track.duration_ms),
          url: track.external_urls?.spotify,
          image: track.album?.images?.[0]?.url,
          plays: track.popularity
        }
      }
    },
    
    // API 3: Nekolabs
    { 
      name: 'Nekolabs', 
      endpoint: `https://api.nekolabs.xyz/api/spotify?q=${encodeURIComponent(query)}`,
      extractor: (res) => {
        if (!res.status || !res.data?.length) return null
        const track = res.data[0]
        return {
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          url: track.url,
          image: track.thumbnail,
          plays: track.popularity
        }
      }
    }
  ]

  for (const { name, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
      clearTimeout(timeout)
      
      const result = extractor(res)
      if (result) {
        console.log(`✅ Spotify search success using ${name}`)
        return result
      }
    } catch (e) {
      console.log(`❌ Spotify search failed using ${name}:`, e.message)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

// Función para obtener info por URL (usamos la misma API de zylalabs si es posible, pero necesitamos API key)
async function getSongInfoFromUrl(url) {
  // Extraemos el ID del track
  const match = url.match(spotifyTrackRegex)
  if (!match) return null
  
  const trackId = match[1]
  
  // Intentamos con la API de zylalabs (que devuelve info además del link)
  if (global.APIs?.zylalabs?.key) {
    try {
      const endpoint = `https://zylalabs.com/api/1599/descargador+de+canciones+de+spotify+api/18130/descargar+canción?songId=${encodeURIComponent(url)}`
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${global.APIs.zylalabs.key}` }
      }).then(r => r.json())
      
      if (res.success && res.data) {
        return {
          title: res.data.title,
          artist: res.data.artist,
          album: res.data.album,
          duration: 'Desconocido', // zylalabs no da duración
          url: url,
          image: res.data.cover,
          plays: null
        }
      }
    } catch (e) {
      console.log('❌ Zylalabs info failed:', e.message)
    }
  }
  
  // Fallback a otras APIs (Vreden, etc.)
  const apis = [
    { 
      name: 'Vreden', 
      endpoint: `https://vreden-api.vercel.app/api/spotify/track?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.result) return null
        const track = res.result
        return {
          title: track.name,
          artist: track.artists?.map(a => a.name).join(', '),
          album: track.album?.name,
          duration: formatDuration(track.duration_ms),
          url: url,
          image: track.album?.images?.[0]?.url,
          plays: track.popularity
        }
      }
    },
    { 
      name: 'Nekolabs', 
      endpoint: `https://api.nekolabs.xyz/api/spotify/info?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.status || !res.data) return null
        const track = res.data
        return {
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          url: url,
          image: track.thumbnail,
          plays: track.popularity
        }
      }
    }
  ]

  for (const { name, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
      clearTimeout(timeout)
      
      const result = extractor(res)
      if (result) {
        console.log(`✅ Spotify URL info success using ${name}`)
        return result
      }
    } catch (e) {
      console.log(`❌ Spotify URL info failed using ${name}:`, e.message)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return null
}

// Función para descargar audio (prioriza zylalabs si es URL y tenemos key)
async function downloadSpotifyAudio(url, isUrl) {
  // Si es una URL y tenemos API key de zylalabs, lo intentamos primero
  if (isUrl && global.APIs?.zylalabs?.key) {
    try {
      const endpoint = `https://zylalabs.com/api/1599/descargador+de+canciones+de+spotify+api/18130/descargar+canción?songId=${encodeURIComponent(url)}`
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${global.APIs.zylalabs.key}` }
      }).then(r => r.json())
      
      if (res.success && res.data?.downloadLink) {
        console.log('✅ Spotify download success using Zylalabs')
        return { url: res.data.downloadLink, api: 'Zylalabs' }
      }
    } catch (e) {
      console.log('❌ Zylalabs download failed:', e.message)
    }
  }

  // Fallback a otras APIs de descarga
  const apis = [
    { 
      name: 'Stellar', 
      endpoint: `${global.APIs?.stellar?.url || 'https://api.stellarapi.com'}/dow/spotify?url=${encodeURIComponent(url)}&apikey=${global.APIs?.stellar?.key || ''}`,
      extractor: (res) => {
        if (!res.data?.download) return null
        return { url: res.data.download, api: 'Stellar' }
      }
    },
    { 
      name: 'Adonix', 
      endpoint: `https://api.adonix.net/api/spotify/download?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.data?.download_url) return null
        return { url: res.data.download_url, api: 'Adonix' }
      }
    },
    { 
      name: 'Vreden', 
      endpoint: `https://vreden-api.vercel.app/api/download/spotify?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.result?.download?.url) return null
        return { url: res.result.download.url, api: 'Vreden' }
      }
    },
    { 
      name: 'Nekolabs', 
      endpoint: `https://api.nekolabs.xyz/api/spotify/download?url=${encodeURIComponent(url)}`,
      extractor: (res) => {
        if (!res.data?.download) return null
        return { url: res.data.download, api: 'Nekolabs' }
      }
    }
  ]

  for (const { name, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
      clearTimeout(timeout)
      
      const result = extractor(res)
      if (result) {
        console.log(`✅ Spotify download success using ${name}`)
        return result
      }
    } catch (e) {
      console.log(`❌ Spotify download failed using ${name}:`, e.message)
    }
    await new Promise(resolve => setTimeout(resolve, 800))
  }
  return null
}

// Función auxiliar para formatear duración
function formatDuration(ms) {
  if (!ms) return 'Desconocido'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
