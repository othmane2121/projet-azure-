const sql = require('mssql');
const dbConfig = {
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: false }
};
let pool = null;
async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}
module.exports = async function (context, req) {
  try {
    const categorie = req.body?.categorie || req.query?.categorie;
    const priorite = req.body?.priorite || req.query?.priorite || 'normal';
    if (!categorie) {
      context.res = { status: 400, body: { error: 'categorie requis' } };
      return;
    }
    const db = await getPool();
    const result = await db.request()
      .input('cat', sql.NVarChar, categorie)
      .input('prio', sql.NVarChar, priorite)
      .query(
        SELECT TOP 1 a.id AS agent_id, a.nom + ' ' + a.prenom AS agent_nom,
          a.email AS agent_email, a.specialite, a.niveau, COUNT(t.id) AS tickets_actifs
        FROM Agents a
        LEFT JOIN Tickets t ON t.agent_id=a.id AND t.statut IN ('ouvert','en_cours','en_attente')
        WHERE a.disponible=1
        GROUP BY a.id, a.nom, a.prenom, a.email, a.specialite, a.niveau
        ORDER BY
          CASE WHEN a.specialite LIKE '%' + @cat + '%' THEN 0
               WHEN @prio='urgent' AND a.niveau='senior' THEN 1
               ELSE 2 END,
          COUNT(t.id) ASC
      );
    if (!result.recordset.length) {
      context.res = { status: 404, body: { error: 'Aucun agent disponible', agent_id: null } };
      return;
    }
    const agent = result.recordset[0];
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        agent_id: agent.agent_id, agent_nom: agent.agent_nom,
        agent_email: agent.agent_email, specialite: agent.specialite,
        niveau: agent.niveau, tickets_actifs: agent.tickets_actifs,
        assigned_at: new Date().toISOString()
      }
    };
  } catch (e) {
    context.log.error('Erreur:', e.message);
    context.res = { status: 500, body: { error: e.message } };
  }
};
