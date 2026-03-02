// ================= COMANDO #transfer =================
// Agrega esto en el archivo donde procesas los mensajes (o como plugin)

// Función para normalizar número: quita espacios, asegura formato completo con @s.whatsapp.net
function normalizeNumber(num) {
    let cleaned = num.replace(/\s+/g, '');
    if (!cleaned.includes('@')) {
        cleaned = cleaned + '@s.whatsapp.net';
    }
    return cleaned;
}

// Función para extraer solo el número (sin dominio) desde un ID de WhatsApp
function getPhoneNumber(id) {
    return id.split('@')[0];
}

// Función para respuestas decoradas (mismo estilo que global.mess)
function formatMessage(text) {
    return `《✧》 ${text}`;
}

client.on('message', async message => {
    const body = message.body;
    if (!body.startsWith('#transfer')) return;

    const authorId = message.author || message.from; // ID completo (ej. 593981305645@s.whatsapp.net)
    const authorPhone = getPhoneNumber(authorId);    // Solo el número (ej. 593981305645)

    // Verificar si el autor está en global.owner (solo números, sin sufijo)
    if (!global.owner.includes(authorPhone)) {
        return message.reply(formatMessage('Este comando solo puede ser ejecutado por un Owner.'));
    }

    const args = body.split(' ').slice(1);
    if (args.length < 2) {
        return message.reply(formatMessage('Uso: #transfer <numero_origen> <numero_destino>\nEjemplo: #transfer 593981305645 593994524688'));
    }

    const origen = normalizeNumber(args[0]);
    const destino = normalizeNumber(args[1]);

    if (origen === destino) {
        return message.reply(formatMessage('El origen y destino no pueden ser el mismo número.'));
    }

    // Cargar base de datos
    global.loadDatabase();

    // Verificar que el origen exista en users
    if (!global.db.data.users[origen]) {
        return message.reply(formatMessage(`El usuario ${origen} no existe en la base de datos.`));
    }

    // Si el destino no existe en users, lo creamos con valores por defecto
    if (!global.db.data.users[destino]) {
        global.db.data.users[destino] = {
            name: null,
            exp: 0,
            level: 0,
            usedcommands: 0,
            pasatiempo: "",
            description: "",
            marry: "",
            genre: "",
            birth: "",
            metadatos: null,
            metadatos2: null
        };
    }

    // --- 1. Transferir datos globales de users ---
    const origenUser = { ...global.db.data.users[origen] }; // copia
    // Sobrescribir destino con datos del origen
    global.db.data.users[destino] = { ...origenUser };
    // Resetear origen a valores por defecto
    global.db.data.users[origen] = {
        name: null,
        exp: 0,
        level: 0,
        usedcommands: 0,
        pasatiempo: "",
        description: "",
        marry: "",
        genre: "",
        birth: "",
        metadatos: null,
        metadatos2: null
    };

    // --- 2. Transferir datos de chats (por cada chat donde el origen tenga datos) ---
    for (const chatId in global.db.data.chats) {
        const chat = global.db.data.chats[chatId];
        if (!chat.users || typeof chat.users !== 'object') continue;

        // Si el origen está en este chat
        if (chat.users[origen]) {
            // Si el destino no existe en este chat, crear con valores por defecto
            if (!chat.users[destino]) {
                chat.users[destino] = {
                    stats: {},
                    usedTime: null,
                    lastCmd: 0,
                    coins: 0,
                    bank: 0,
                    afk: -1,
                    afkReason: "",
                    characters: []
                };
            }

            // Transferir: destino obtiene los datos del origen
            chat.users[destino] = { ...chat.users[origen] };

            // Resetear origen en este chat
            chat.users[origen] = {
                stats: {},
                usedTime: null,
                lastCmd: 0,
                coins: 0,
                bank: 0,
                afk: -1,
                afkReason: "",
                characters: []
            };
        }
    }

    // Guardar cambios
    global.saveDatabase();

    await message.reply(formatMessage(`Progreso transferido exitosamente de ${origen} a ${destino}.`));
});
