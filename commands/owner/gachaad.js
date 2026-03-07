import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import util from 'util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const execPromise = util.promisify(exec)

const CHARACTER_FILE = path.resolve(process.cwd(), 'database', 'character.json')
const REPO_ROOT = path.join(__dirname, '../..')  // Misma raíz que en tu comando fix
const formatMessage = (text) => `《✧》 ${text}`

async function readCharacterFile() {
    try {
        const data = await fs.readFile(CHARACTER_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (err) {
        if (err.code === 'ENOENT') return {}
        throw err
    }
}

async function writeCharacterFile(data) {
    await fs.writeFile(CHARACTER_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

async function gitCommitAndPush(commitMessage) {
    try {
        // 1. git add database/character.json
        await execPromise(`git add ${CHARACTER_FILE}`, { cwd: REPO_ROOT })

        // 2. Verificar si hay cambios para commit
        const { stdout: status } = await execPromise('git status --porcelain', { cwd: REPO_ROOT })
        if (!status.includes('database/character.json')) {
            return { committed: false, message: 'No hay cambios en character.json' }
        }

        // 3. git commit
        await execPromise(`git commit -m "Actualización automática: ${commitMessage}"`, { cwd: REPO_ROOT })

        // 4. git push
        const { stdout: pushOutput } = await execPromise('git push', { cwd: REPO_ROOT })

        return { committed: true, message: pushOutput }
    } catch (error) {
        console.error('Git error:', error)
        throw new Error(`Error en git: ${error.message}`)
    }
}

export default {
    command: ['addseries', 'addserie', 'añadirserie', 'addcharacter', 'addchar', 'añadirpersonaje'],
    isOwner: true,
    run: async (client, m, args, usedPrefix, command) => {
        try {
            const isSeries = ['addseries', 'addserie', 'añadirserie'].includes(command)
            const isCharacter = ['addcharacter', 'addchar', 'añadirpersonaje'].includes(command)

            if (isSeries) {
                // ---------- AGREGAR SERIE ----------
                if (args.length < 2) {
                    return client.reply(m.chat, formatMessage(`❌ Uso correcto:\n#addseries <ID> <Nombre> [tags separadas por coma]\nEjemplo: #addseries 60002946 "Nier Automata" nier,automata`), m)
                }

                const serieId = args[0]
                const nombreSerie = args[1]
                let tags = []
                if (args[2]) {
                    tags = args[2].split(',').map(t => t.trim())
                }

                await m.react('🕒')

                const data = await readCharacterFile()

                if (data[serieId]) {
                    await m.react('✖️')
                    return client.reply(m.chat, formatMessage(`La serie con ID ${serieId} ya existe.`), m)
                }

                data[serieId] = {
                    name: nombreSerie,
                    tags: tags,
                    characters: []
                }

                await writeCharacterFile(data)

                // Git push
                let gitMsg = ''
                try {
                    const gitResult = await gitCommitAndPush(`Añadida serie ${nombreSerie} (ID: ${serieId})`)
                    if (gitResult.committed) {
                        gitMsg = '\n✅ Sincronizado con GitHub'
                    } else {
                        gitMsg = `\n⚠️ ${gitResult.message}`
                    }
                } catch (gitError) {
                    gitMsg = `\n❌ Error al sincronizar con GitHub: ${gitError.message}`
                }

                await m.react('✔️')
                client.reply(m.chat, formatMessage(`✅ Serie agregada.\nID: ${serieId}\nNombre: ${nombreSerie}\nTags: ${tags.join(', ') || 'ninguno'}${gitMsg}`), m)

            } else if (isCharacter) {
                // ---------- AGREGAR PERSONAJE ----------
                if (args.length < 2) {
                    return client.reply(m.chat, formatMessage(`❌ Uso correcto:\n#addcharacter <IDserie> <Nombre> [Género] [tags] [Valor]\nEjemplo: #addcharacter 60002946 "2B" Femenino android,2b 150`), m)
                }

                const serieId = args[0]
                const nombre = args[1]
                let gender = 'Desconocido'
                let tags = []
                let value = 100

                let idx = 2
                if (args[idx] && !args[idx].includes(',')) {
                    gender = args[idx]
                    idx++
                }
                if (args[idx] && args[idx].includes(',')) {
                    tags = args[idx].split(',').map(t => t.trim())
                    idx++
                }
                if (args[idx] && !isNaN(parseInt(args[idx]))) {
                    value = parseInt(args[idx])
                }

                await m.react('🕒')

                const data = await readCharacterFile()

                if (!data[serieId]) {
                    await m.react('✖️')
                    return client.reply(m.chat, formatMessage(`La serie con ID ${serieId} no existe. Usa #addseries primero.`), m)
                }

                const serie = data[serieId]

                // Generar ID correlativo
                let maxNum = 0
                for (const char of serie.characters) {
                    if (char.id.startsWith(serieId)) {
                        const numPart = char.id.slice(serieId.length)
                        const num = parseInt(numPart, 10)
                        if (!isNaN(num) && num > maxNum) maxNum = num
                    }
                }
                const newNum = (maxNum + 1).toString().padStart(3, '0')
                const newId = serieId + newNum

                if (serie.characters.some(c => c.id === newId)) {
                    await m.react('✖️')
                    return client.reply(m.chat, formatMessage(`Error interno: el ID generado ${newId} ya existe.`), m)
                }

                const newCharacter = {
                    id: newId,
                    name: nombre,
                    gender: gender,
                    tags: tags,
                    value: value
                }

                serie.characters.push(newCharacter)
                await writeCharacterFile(data)

                // Git push
                let gitMsg = ''
                try {
                    const gitResult = await gitCommitAndPush(`Añadido personaje ${nombre} a serie ${serie.name} (ID: ${newId})`)
                    if (gitResult.committed) {
                        gitMsg = '\n✅ Sincronizado con GitHub'
                    } else {
                        gitMsg = `\n⚠️ ${gitResult.message}`
                    }
                } catch (gitError) {
                    gitMsg = `\n❌ Error al sincronizar con GitHub: ${gitError.message}`
                }

                await m.react('✔️')
                client.reply(m.chat, formatMessage(`✅ Personaje agregado a ${serie.name}.\nID: ${newId}\nNombre: ${nombre}\nGénero: ${gender}\nTags: ${tags.join(', ') || 'ninguno'}\nValor: ${value}${gitMsg}`), m)
            }
        } catch (error) {
            console.error(error)
            await m.react('✖️')
            client.reply(m.chat, `⚠︎ Error: ${error.message}`, m)
        }
    }
}
