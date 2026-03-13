// lib/system/groupUpdater.js
export async function updateBotGroups(client) {
    const botJid = client.user.id.split(':')[0] + '@s.whatsapp.net';
    if (!global.db.data.settings[botJid]) global.db.data.settings[botJid] = {};

    try {
        const groups = await client.groupFetchAllParticipating();
        const groupsData = {};

        for (const [id, metadata] of Object.entries(groups)) {
            // Verificar si el bot es admin en el grupo
            const isAdmin = metadata.participants.some(p => 
                (p.id === botJid || p.phoneNumber === botJid) && 
                (p.admin === 'admin' || p.admin === 'superadmin')
            );

            let inviteLink = null;
            if (isAdmin) {
                try {
                    const code = await client.groupInviteCode(id);
                    inviteLink = `https://chat.whatsapp.com/${code}`;
                } catch (e) {
                    // El bot puede no tener permiso para obtener el link si no es admin
                }
            }

            groupsData[id] = {
                name: metadata.subject,
                link: inviteLink,
                admin: isAdmin
            };
        }

        global.db.data.settings[botJid].groups = groupsData;
        if (typeof global.saveDatabase === 'function') global.saveDatabase();
        console.log(`✅ Grupos actualizados para ${botJid}`);
    } catch (error) {
        console.error(`❌ Error al actualizar grupos de ${botJid}:`, error);
    }
}
