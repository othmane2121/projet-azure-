const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Dossier uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// ── Servir les fichiers statiques des portails
app.use('/user',  express.static(path.join(__dirname, 'public', 'user-portal')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin-portal')));
app.use('/',      express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════
// AZURE SQL CONFIG
// ════════════════════════════════════════
const dbConfig = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool = null;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('Azure SQL connecte');
  }
  return pool;
}

// ════════════════════════════════════════
// EMAIL GMAIL
// ════════════════════════════════════════
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) return;
  try {
    await transporter.sendMail({
      from: `"SupportMH" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
    console.log('Email envoye a:', to);
  } catch (e) {
    console.error('Email erreur:', e.message);
  }
}

// ════════════════════════════════════════
// JWT MIDDLEWARE
// ════════════════════════════════════════
function auth(type = 'any') {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    try {
      const d = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      if (type !== 'any' && d.type !== type)
        return res.status(403).json({ error: 'Acces refuse' });
      req.user = d;
      next();
    } catch { res.status(401).json({ error: 'Token invalide' }); }
  };
}

// ════════════════════════════════════════
// UPLOAD MULTER
// ════════════════════════════════════════
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ════════════════════════════════════════
// HELPER — APPEL AZURE FUNCTIONS
// ════════════════════════════════════════
async function callFunction(url, method = 'GET', body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`Function error: ${r.status}`);
  return r.json();
}

// ── Générer référence ticket via Azure Function ou fallback local
async function generateTicketRef(db) {
  if (process.env.FUNC_TICKET_URL) {
    try {
      const result = await callFunction(process.env.FUNC_TICKET_URL);
      console.log('Reference via Azure Function:', result.reference);
      return result.reference;
    } catch (e) {
      console.warn('Azure Function GenerateTicketNumber indisponible - fallback local:', e.message);
    }
  }
  const year = new Date().getFullYear();
  const cnt = await db.request()
    .query(`SELECT COUNT(*) as c FROM Tickets WHERE YEAR(date_creation)=${year}`);
  return `TKT-${year}-${String(cnt.recordset[0].c + 1).padStart(4, '0')}`;
}

// ── Assigner agent via Azure Function ou fallback local
async function assignAgent(db, categorie, priorite) {
  if (process.env.FUNC_ASSIGN_URL) {
    try {
      const result = await callFunction(
        process.env.FUNC_ASSIGN_URL, 'POST',
        { categorie, priorite: priorite || 'normal' }
      );
      if (result.agent_id) {
        console.log('Agent assigne via Azure Function:', result.agent_nom);
        return result;
      }
    } catch (e) {
      console.warn('Azure Function AssignAgent indisponible - fallback local:', e.message);
    }
  }
  const r = await db.request()
    .input('cat',  sql.NVarChar, categorie)
    .input('prio', sql.NVarChar, priorite || 'normal')
    .query(`
      SELECT TOP 1
        a.id AS agent_id,
        a.nom + ' ' + a.prenom AS agent_nom,
        a.email AS agent_email,
        a.specialite, a.niveau,
        COUNT(t.id) AS tickets_actifs
      FROM Agents a
      LEFT JOIN Tickets t ON t.agent_id=a.id AND t.statut IN ('ouvert','en_cours','en_attente')
      WHERE a.disponible=1
      GROUP BY a.id, a.nom, a.prenom, a.email, a.specialite, a.niveau
      ORDER BY
        CASE WHEN a.specialite LIKE '%' + @cat + '%' THEN 0
             WHEN @prio='urgent' AND a.niveau='senior' THEN 1
             ELSE 2 END,
        COUNT(t.id) ASC`);
  return r.recordset[0] || null;
}

// ════════════════════════════════════════
// ROUTES PAGES
// ════════════════════════════════════════
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'user-portal', 'index.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-portal', 'index.html'));
});

// ════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    functions: {
      ticketGenerator: process.env.FUNC_TICKET_URL ? 'configured' : 'local_fallback',
      agentAssign:     process.env.FUNC_ASSIGN_URL  ? 'configured' : 'local_fallback'
    }
  });
});

// ════════════════════════════════════════
// AUTH — INSCRIPTION
// ════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nom, prenom, email, mot_de_passe, departement, telephone } = req.body;
    if (!nom || !prenom || !email || !mot_de_passe)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });

    const db = await getPool();
    const exist = await db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Utilisateurs WHERE email=@email');
    if (exist.recordset.length > 0)
      return res.status(400).json({ error: 'Email deja utilise' });

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const result = await db.request()
      .input('nom',    sql.NVarChar, nom)
      .input('prenom', sql.NVarChar, prenom)
      .input('email',  sql.NVarChar, email)
      .input('hash',   sql.NVarChar, hash)
      .input('dept',   sql.NVarChar, departement || null)
      .input('tel',    sql.NVarChar, telephone   || null)
      .query(`INSERT INTO Utilisateurs (nom,prenom,email,mot_de_passe,departement,telephone)
              OUTPUT INSERTED.id VALUES (@nom,@prenom,@email,@hash,@dept,@tel)`);

    const userId = result.recordset[0].id;
    const token = jwt.sign(
      { id: userId, email, type: 'utilisateur' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    await sendEmail(email, 'Bienvenue sur SupportMH', `
      <div style="font-family:Arial;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#0070C0">Bienvenue ${prenom} ${nom} !</h2>
        <p>Votre compte SupportMH a ete cree avec succes.</p>
        <p>Acces a votre portail : <a href="${process.env.APP_URL}/user">${process.env.APP_URL}/user</a></p>
        <hr><p style="color:#888;font-size:12px">SupportMH</p>
      </div>`);

    res.status(201).json({ token, user: { id: userId, nom, prenom, email, type: 'utilisateur' } });
  } catch (e) {
    console.error('Register:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// AUTH — CONNEXION
// ════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, mot_de_passe, type } = req.body;
    if (!email || !mot_de_passe)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const db = await getPool();
    const table = type === 'agent' ? 'Agents' : 'Utilisateurs';
    const r = await db.request()
      .input('email', sql.NVarChar, email)
      .query(`SELECT * FROM ${table} WHERE email=@email`);

    if (!r.recordset.length)
      return res.status(401).json({ error: 'Identifiants incorrects' });

    const u = r.recordset[0];
    if (!(await bcrypt.compare(mot_de_passe, u.mot_de_passe)))
      return res.status(401).json({ error: 'Identifiants incorrects' });

    try {
      await db.request().input('id', sql.Int, u.id)
        .query(`UPDATE ${table} SET derniere_connexion=GETDATE() WHERE id=@id`);
    } catch (e) {
      console.warn('derniere_connexion update skipped:', e.message);
    }

    const token = jwt.sign(
      { id: u.id, email: u.email, type: type || 'utilisateur', niveau: u.niveau },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, type: type || 'utilisateur', niveau: u.niveau }
    });
  } catch (e) {
    console.error('Login:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// TICKETS — CREER (avec Azure Functions)
// ════════════════════════════════════════
app.post('/api/tickets', auth('utilisateur'), upload.single('piece_jointe'), async (req, res) => {
  try {
    const { titre, description, categorie, priorite, tags } = req.body;
    if (!titre || !description || !categorie)
      return res.status(400).json({ error: 'Titre, description et categorie requis' });

    const db = await getPool();

    // ── Azure Function 1 : Générer numéro de ticket ──
    const ref = await generateTicketRef(db);

    // ── Azure Function 2 : Attribution automatique agent ──
    const agentData = await assignAgent(db, categorie, priorite);
    const agentId   = agentData?.agent_id  || null;
    const agentNom  = agentData?.agent_nom || null;

    // ── Calcul SLA ──
    const slaH = { urgent: 4, normal: 24, faible: 72 };
    const sla  = new Date();
    sla.setHours(sla.getHours() + (slaH[priorite] || 24));

    // ── Insérer le ticket ──
    const result = await db.request()
      .input('ref',    sql.NVarChar,  ref)
      .input('titre',  sql.NVarChar,  titre)
      .input('desc',   sql.NVarChar,  description)
      .input('cat',    sql.NVarChar,  categorie)
      .input('prio',   sql.NVarChar,  priorite || 'normal')
      .input('uid',    sql.Int,       req.user.id)
      .input('aid',    sql.Int,       agentId)
      .input('statut', sql.NVarChar,  agentId ? 'en_cours' : 'ouvert')
      .input('sla',    sql.DateTime2, sla)
      .input('tags',   sql.NVarChar,  tags || null)
      .input('pj',     sql.NVarChar,  req.file ? `/uploads/${req.file.filename}` : null)
      .query(`
        INSERT INTO Tickets
          (reference,titre,description,categorie,priorite,utilisateur_id,agent_id,statut,sla_echeance,tags,piece_jointe_url)
        OUTPUT INSERTED.*
        VALUES (@ref,@titre,@desc,@cat,@prio,@uid,@aid,@statut,@sla,@tags,@pj)`);

    const ticket = result.recordset[0];

    // ── Historique création ──
    await db.request()
      .input('tid', sql.Int, ticket.id)
      .input('uid', sql.Int, req.user.id)
      .query(`INSERT INTO HistoriqueTickets (ticket_id,auteur_id,auteur_type,action,nouveau_statut)
              VALUES (@tid,@uid,'utilisateur','creation','ouvert')`);

    // ── Historique assignation ──
    if (agentId) {
      await db.request()
        .input('tid', sql.Int, ticket.id)
        .input('aid', sql.Int, agentId)
        .query(`INSERT INTO HistoriqueTickets
                  (ticket_id,auteur_id,auteur_type,action,nouveau_statut,commentaire)
                VALUES (@tid,@aid,'agent','assignation','en_cours','Assignation automatique via Azure Function')`);
    }

    // ── Email de confirmation ──
    const ur = await db.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT * FROM Utilisateurs WHERE id=@id');
    const u = ur.recordset[0];

    await sendEmail(u.email, `Ticket ${ref} cree — SupportMH`, `
      <div style="font-family:Arial;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#0070C0">Votre ticket a été créé</h2>
        <p>Bonjour <strong>${u.prenom} ${u.nom}</strong>,</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="background:#f1f5f9">
            <td style="padding:10px;border:1px solid #ddd"><strong>Reference</strong></td>
            <td style="padding:10px;border:1px solid #ddd"><strong>${ref}</strong></td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd">Titre</td>
            <td style="padding:10px;border:1px solid #ddd">${titre}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:10px;border:1px solid #ddd">Priorite</td>
            <td style="padding:10px;border:1px solid #ddd">${priorite || 'normal'}</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #ddd">Agent </td>
            <td style="padding:10px;border:1px solid #ddd">${agentNom || 'En attente d\'assignation'}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:10px;border:1px solid #ddd">Delai </td>
            <td style="padding:10px;border:1px solid #ddd">${sla.toLocaleString('fr-FR')}</td>
          </tr>
        </table>
        <p>Suivez votre ticket : <a href="${process.env.APP_URL}/user">${process.env.APP_URL}/user</a></p>
        <hr><p style="color:#888;font-size:12px">SupportMH</p>
      </div>`);

    res.status(201).json({
      ticket,
      message: 'Ticket cree avec succes',
      reference: ref,
      agent_assigne: agentNom || null
    });

  } catch (e) {
    console.error('Create ticket:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// TICKETS — LISTER
// ════════════════════════════════════════
app.get('/api/tickets', auth(), async (req, res) => {
  try {
    const db = await getPool();
    const { statut, priorite, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = req.user.type === 'utilisateur'
      ? `WHERE t.utilisateur_id=${req.user.id}` : 'WHERE 1=1';
    if (statut)   where += ` AND t.statut='${statut}'`;
    if (priorite) where += ` AND t.priorite='${priorite}'`;

    const r = await db.request().query(`
      SELECT t.*,
        u.nom+' '+u.prenom AS utilisateur_nom,
        a.nom+' '+a.prenom AS agent_nom,
        (SELECT COUNT(*) FROM Commentaires WHERE ticket_id=t.id AND interne=0) AS nb_commentaires
      FROM Tickets t
      LEFT JOIN Utilisateurs u ON t.utilisateur_id=u.id
      LEFT JOIN Agents       a ON t.agent_id=a.id
      ${where}
      ORDER BY
        CASE t.priorite WHEN 'urgent' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        t.date_creation DESC
      OFFSET ${offset} ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`);

    const total = await db.request()
      .query(`SELECT COUNT(*) AS total FROM Tickets t ${where}`);

    res.json({ tickets: r.recordset, total: total.recordset[0].total, page: parseInt(page) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// TICKETS — DETAIL
// ════════════════════════════════════════
app.get('/api/tickets/:id', auth(), async (req, res) => {
  try {
    const db = await getPool();
    const tr = await db.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT t.*,
          u.nom+' '+u.prenom AS utilisateur_nom, u.email AS utilisateur_email,
          a.nom+' '+a.prenom AS agent_nom,        a.email AS agent_email
        FROM Tickets t
        LEFT JOIN Utilisateurs u ON t.utilisateur_id=u.id
        LEFT JOIN Agents       a ON t.agent_id=a.id
        WHERE t.id=@id`);

    if (!tr.recordset.length)
      return res.status(404).json({ error: 'Ticket non trouve' });

    const ticket = tr.recordset[0];
    if (req.user.type === 'utilisateur' && ticket.utilisateur_id !== req.user.id)
      return res.status(403).json({ error: 'Acces refuse' });

    const commentaires = await db.request()
      .input('tid', sql.Int, req.params.id)
      .query(`
        SELECT c.*,
          CASE c.auteur_type
            WHEN 'utilisateur' THEN (SELECT nom+' '+prenom FROM Utilisateurs WHERE id=c.auteur_id)
            ELSE                    (SELECT nom+' '+prenom FROM Agents       WHERE id=c.auteur_id)
          END AS auteur_nom
        FROM Commentaires c
        WHERE c.ticket_id=@tid
        ${req.user.type === 'utilisateur' ? 'AND c.interne=0' : ''}
        ORDER BY c.date_creation ASC`);

    const historique = await db.request()
      .input('tid', sql.Int, req.params.id)
      .query('SELECT * FROM HistoriqueTickets WHERE ticket_id=@tid ORDER BY date_action');

    res.json({ ticket, commentaires: commentaires.recordset, historique: historique.recordset });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// TICKETS — CHANGER STATUT
// ════════════════════════════════════════
app.patch('/api/tickets/:id/statut', auth('agent'), async (req, res) => {
  try {
    const { statut, commentaire } = req.body;
    const db = await getPool();
    const tr = await db.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Tickets WHERE id=@id');
    if (!tr.recordset.length)
      return res.status(404).json({ error: 'Ticket non trouve' });
    const ticket = tr.recordset[0];

    await db.request()
      .input('id',     sql.Int,       req.params.id)
      .input('statut', sql.NVarChar,  statut)
      .input('aid',    sql.Int,       req.user.id)
      .input('dr',     sql.DateTime2, statut === 'resolu' ? new Date() : null)
      .query('UPDATE Tickets SET statut=@statut,agent_id=@aid,date_mise_a_jour=GETDATE(),date_resolution=@dr WHERE id=@id');

    await db.request()
      .input('tid', sql.Int,      req.params.id)
      .input('aid', sql.Int,      req.user.id)
      .input('old', sql.NVarChar, ticket.statut)
      .input('new', sql.NVarChar, statut)
      .input('com', sql.NVarChar, commentaire || null)
      .query(`INSERT INTO HistoriqueTickets
                (ticket_id,auteur_id,auteur_type,action,ancien_statut,nouveau_statut,commentaire)
              VALUES (@tid,@aid,'agent','changement_statut',@old,@new,@com)`);

    const ur = await db.request()
      .input('id', sql.Int, ticket.utilisateur_id)
      .query('SELECT * FROM Utilisateurs WHERE id=@id');
    const u = ur.recordset[0];
    const labels = { en_cours:'En cours', resolu:'Resolu', ferme:'Ferme', en_attente:'En attente' };

    await sendEmail(u.email, `Ticket ${ticket.reference} mis a jour — SupportMH`, `
      <div style="font-family:Arial;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
        <h2 style="color:#0070C0">Statut mis a jour</h2>
        <p>Bonjour <strong>${u.prenom} ${u.nom}</strong>,</p>
        <p>Ticket <strong>${ticket.reference}</strong> : <strong>${labels[statut] || statut}</strong></p>
        ${commentaire ? `<p>Commentaire : ${commentaire}</p>` : ''}
        <p><a href="${process.env.APP_URL}/user">${process.env.APP_URL}/user</a></p>
        <hr><p style="color:#888;font-size:12px">SupportMH</p>
      </div>`);

    res.json({ message: 'Statut mis a jour' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// COMMENTAIRES (avec pièce jointe)
// ════════════════════════════════════════
app.post('/api/tickets/:id/commentaires', auth(), upload.single('piece_jointe'), async (req, res) => {
  try {
    const { contenu, interne } = req.body;
    if (!contenu && !req.file)
      return res.status(400).json({ error: 'Contenu requis' });

    const db = await getPool();
    const tr = await db.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Tickets WHERE id=@id');
    if (!tr.recordset.length)
      return res.status(404).json({ error: 'Ticket non trouve' });
    const ticket = tr.recordset[0];
    if (req.user.type === 'utilisateur' && ticket.utilisateur_id !== req.user.id)
      return res.status(403).json({ error: 'Acces refuse' });

    const pieceJointe = req.file ? '/uploads/' + req.file.filename : null;
    const interneVal  = (interne === true || interne === 1 || interne === '1' || interne === 'true') ? 1 : 0;

    const r = await db.request()
      .input('tid',     sql.Int,      req.params.id)
      .input('aid',     sql.Int,      req.user.id)
      .input('atype',   sql.NVarChar, req.user.type)
      .input('contenu', sql.NVarChar, contenu || '(fichier joint)')
      .input('interne', sql.Bit,      interneVal)
      .input('pj',      sql.NVarChar, pieceJointe)
      .query(`INSERT INTO Commentaires (ticket_id,auteur_id,auteur_type,contenu,interne,piece_jointe_url)
              OUTPUT INSERTED.* VALUES (@tid,@aid,@atype,@contenu,@interne,@pj)`);

    await db.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE Tickets SET date_mise_a_jour=GETDATE() WHERE id=@id');

    if (req.user.type === 'agent' && !interneVal) {
      const ur = await db.request()
        .input('id', sql.Int, ticket.utilisateur_id)
        .query('SELECT * FROM Utilisateurs WHERE id=@id');
      const u = ur.recordset[0];
      await sendEmail(u.email, `Reponse agent — ${ticket.reference}`, `
        <div style="font-family:Arial;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#0070C0">L'agent a repondu</h2>
          <p>Bonjour <strong>${u.prenom} ${u.nom}</strong>,</p>
          <div style="padding:14px;background:#f8fafc;border-left:4px solid #0070C0;margin:16px 0">${contenu}</div>
          <p><a href="${process.env.APP_URL}/user">${process.env.APP_URL}/user</a></p>
          <hr><p style="color:#888;font-size:12px">SupportMH</p>
        </div>`);
    }

    res.status(201).json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// TICKETS — ASSIGNER MANUELLEMENT
// ════════════════════════════════════════
app.patch('/api/tickets/:id/assigner', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    await db.request()
      .input('id',  sql.Int, req.params.id)
      .input('aid', sql.Int, req.body.agent_id || req.user.id)
      .query("UPDATE Tickets SET agent_id=@aid,statut='en_cours',date_mise_a_jour=GETDATE() WHERE id=@id");
    res.json({ message: 'Assigne' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// TICKETS — SATISFACTION
// ════════════════════════════════════════
app.post('/api/tickets/:id/satisfaction', auth('utilisateur'), async (req, res) => {
  try {
    const db = await getPool();
    await db.request()
      .input('id',   sql.Int, req.params.id)
      .input('note', sql.Int, req.body.note)
      .input('uid',  sql.Int, req.user.id)
      .query('UPDATE Tickets SET satisfaction=@note WHERE id=@id AND utilisateur_id=@uid');
    res.json({ message: 'Evaluation enregistree' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// ADMIN — STATS
// ════════════════════════════════════════
app.get('/api/admin/stats', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request().query(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN statut='ouvert'   THEN 1 ELSE 0 END) AS ouverts,
        SUM(CASE WHEN statut='en_cours' THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN statut='resolu'   THEN 1 ELSE 0 END) AS resolus,
        SUM(CASE WHEN priorite='urgent' THEN 1 ELSE 0 END) AS urgents
      FROM Tickets`);
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// AGENTS — LISTER
// ════════════════════════════════════════
app.get('/api/agents', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request().query(`
      SELECT a.id, a.nom, a.prenom, a.email, a.specialite, a.niveau, a.disponible,
        COUNT(t.id) AS tickets_actifs
      FROM Agents a
      LEFT JOIN Tickets t ON t.agent_id=a.id AND t.statut='en_cours'
      GROUP BY a.id, a.nom, a.prenom, a.email, a.specialite, a.niveau, a.disponible`);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════
// AGENTS — CRÉER
// ════════════════════════════════════════
app.post('/api/agents', auth('agent'), async (req, res) => {
  try {
    const { prenom, nom, email, mot_de_passe, specialite, niveau } = req.body;
    if (!prenom || !nom || !email || !mot_de_passe)
      return res.status(400).json({ error: 'prenom, nom, email et mot_de_passe requis' });
    if (mot_de_passe.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court' });

    const db = await getPool();
    const exist = await db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Agents WHERE email=@email');
    if (exist.recordset.length > 0)
      return res.status(409).json({ error: 'Email deja utilise par un agent' });

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const result = await db.request()
      .input('nom',        sql.NVarChar, nom)
      .input('prenom',     sql.NVarChar, prenom)
      .input('email',      sql.NVarChar, email)
      .input('hash',       sql.NVarChar, hash)
      .input('specialite', sql.NVarChar, specialite || 'General')
      .input('niveau',     sql.NVarChar, niveau     || 'niveau1')
      .query(`INSERT INTO Agents (nom,prenom,email,mot_de_passe,specialite,niveau)
              OUTPUT INSERTED.id,INSERTED.prenom,INSERTED.nom,INSERTED.email,INSERTED.niveau,INSERTED.specialite
              VALUES (@nom,@prenom,@email,@hash,@specialite,@niveau)`);
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error('POST /api/agents:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// AGENTS — MODIFIER
// ════════════════════════════════════════
app.put('/api/agents/:id', auth('agent'), async (req, res) => {
  try {
    const { prenom, nom, email, specialite, niveau, mot_de_passe } = req.body;
    if (!prenom || !nom || !email)
      return res.status(400).json({ error: 'prenom, nom et email requis' });

    const db = await getPool();
    const exist = await db.request()
      .input('email', sql.NVarChar, email)
      .input('id',    sql.Int,      req.params.id)
      .query('SELECT id FROM Agents WHERE email=@email AND id!=@id');
    if (exist.recordset.length > 0)
      return res.status(409).json({ error: 'Email deja utilise par un autre agent' });

    let setParts = 'nom=@nom,prenom=@prenom,email=@email,specialite=@specialite,niveau=@niveau';
    const req2 = db.request()
      .input('id',         sql.Int,      req.params.id)
      .input('nom',        sql.NVarChar, nom)
      .input('prenom',     sql.NVarChar, prenom)
      .input('email',      sql.NVarChar, email)
      .input('specialite', sql.NVarChar, specialite || 'General')
      .input('niveau',     sql.NVarChar, niveau     || 'niveau1');

    if (mot_de_passe && mot_de_passe.length >= 6) {
      const hash = await bcrypt.hash(mot_de_passe, 10);
      setParts += ',mot_de_passe=@hash';
      req2.input('hash', sql.NVarChar, hash);
    }
    await req2.query(`UPDATE Agents SET ${setParts} WHERE id=@id`);
    res.json({ message: 'Agent modifie', id: req.params.id });
  } catch (e) {
    console.error('PUT /api/agents/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// AGENTS — SUPPRIMER
// ════════════════════════════════════════
app.delete('/api/agents/:id', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    await db.request().input('id', sql.Int, req.params.id)
      .query('UPDATE Tickets SET agent_id=NULL WHERE agent_id=@id');
    await db.request().input('id', sql.Int, req.params.id)
      .query("DELETE FROM Notifications WHERE destinataire_id=@id AND destinataire_type='agent'");
    await db.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM Agents WHERE id=@id');
    res.json({ message: 'Agent supprime', id: req.params.id });
  } catch (e) {
    console.error('DELETE /api/agents/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// UTILISATEURS — LISTER
// ════════════════════════════════════════
app.get('/api/utilisateurs', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request().query(`
      SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.departement,
             u.statut, u.date_creation, COUNT(t.id) AS nb_tickets
      FROM Utilisateurs u
      LEFT JOIN Tickets t ON t.utilisateur_id=u.id
      GROUP BY u.id,u.nom,u.prenom,u.email,u.telephone,u.departement,u.statut,u.date_creation
      ORDER BY u.date_creation DESC`);
    res.json(r.recordset);
  } catch (e) {
    console.error('GET /api/utilisateurs:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// UTILISATEURS — CRÉER
// ════════════════════════════════════════
app.post('/api/utilisateurs', auth('agent'), async (req, res) => {
  try {
    const { prenom, nom, email, mot_de_passe, telephone, departement, statut } = req.body;
    if (!prenom || !nom || !email || !mot_de_passe)
      return res.status(400).json({ error: 'prenom, nom, email et mot_de_passe requis' });
    if (mot_de_passe.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court' });

    const db = await getPool();
    const exist = await db.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Utilisateurs WHERE email=@email');
    if (exist.recordset.length > 0)
      return res.status(409).json({ error: 'Email deja utilise' });

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const result = await db.request()
      .input('nom',         sql.NVarChar, nom)
      .input('prenom',      sql.NVarChar, prenom)
      .input('email',       sql.NVarChar, email)
      .input('hash',        sql.NVarChar, hash)
      .input('telephone',   sql.NVarChar, telephone   || null)
      .input('departement', sql.NVarChar, departement || null)
      .input('statut',      sql.NVarChar, statut      || 'actif')
      .query(`INSERT INTO Utilisateurs (nom,prenom,email,mot_de_passe,telephone,departement,statut)
              OUTPUT INSERTED.id,INSERTED.prenom,INSERTED.nom,INSERTED.email,INSERTED.statut
              VALUES (@nom,@prenom,@email,@hash,@telephone,@departement,@statut)`);
    res.status(201).json(result.recordset[0]);
  } catch (e) {
    console.error('POST /api/utilisateurs:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// UTILISATEURS — MODIFIER
// ════════════════════════════════════════
app.put('/api/utilisateurs/:id', auth('agent'), async (req, res) => {
  try {
    const { prenom, nom, email, telephone, departement, statut, mot_de_passe } = req.body;
    if (!prenom || !nom || !email)
      return res.status(400).json({ error: 'prenom, nom et email requis' });

    const db = await getPool();
    const exist = await db.request()
      .input('email', sql.NVarChar, email)
      .input('id',    sql.Int,      req.params.id)
      .query('SELECT id FROM Utilisateurs WHERE email=@email AND id!=@id');
    if (exist.recordset.length > 0)
      return res.status(409).json({ error: 'Email deja utilise par un autre compte' });

    let setParts = 'nom=@nom,prenom=@prenom,email=@email,telephone=@telephone,departement=@departement,statut=@statut';
    const req2 = db.request()
      .input('id',          sql.Int,      req.params.id)
      .input('nom',         sql.NVarChar, nom)
      .input('prenom',      sql.NVarChar, prenom)
      .input('email',       sql.NVarChar, email)
      .input('telephone',   sql.NVarChar, telephone   || null)
      .input('departement', sql.NVarChar, departement || null)
      .input('statut',      sql.NVarChar, statut      || 'actif');

    if (mot_de_passe && mot_de_passe.length >= 6) {
      const hash = await bcrypt.hash(mot_de_passe, 10);
      setParts += ',mot_de_passe=@hash';
      req2.input('hash', sql.NVarChar, hash);
    }
    await req2.query(`UPDATE Utilisateurs SET ${setParts} WHERE id=@id`);
    res.json({ message: 'Utilisateur modifie', id: req.params.id });
  } catch (e) {
    console.error('PUT /api/utilisateurs/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// UTILISATEURS — SUPPRIMER
// ════════════════════════════════════════
app.delete('/api/utilisateurs/:id', auth('agent'), async (req, res) => {
  try {
    const db = await getPool();
    await db.request().input('id', sql.Int, req.params.id)
      .query("DELETE FROM Notifications WHERE destinataire_id=@id AND destinataire_type='utilisateur'");
    await db.request().input('id', sql.Int, req.params.id)
      .query("DELETE FROM Commentaires WHERE auteur_id=@id AND auteur_type='utilisateur'");
    await db.request().input('id', sql.Int, req.params.id)
      .query("DELETE FROM HistoriqueTickets WHERE auteur_id=@id AND auteur_type='utilisateur'");
    await db.request().input('id', sql.Int, req.params.id)
      .query('UPDATE Tickets SET utilisateur_id=NULL WHERE utilisateur_id=@id');
    await db.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM Utilisateurs WHERE id=@id');
    res.json({ message: 'Utilisateur supprime', id: req.params.id });
  } catch (e) {
    console.error('DELETE /api/utilisateurs/:id:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// DEMARRAGE
// ════════════════════════════════════════
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SupportMH demarre sur le port ${PORT}`);
  console.log(`Accueil       : http://localhost:${PORT}`);
  console.log(`Portail User  : http://localhost:${PORT}/user`);
  console.log(`Portail Admin : http://localhost:${PORT}/admin`);
  console.log(`Health        : http://localhost:${PORT}/health`);
  console.log(`Azure Func Ticket : ${process.env.FUNC_TICKET_URL ? 'Configure' : 'Fallback local'}`);
  console.log(`Azure Func Agent  : ${process.env.FUNC_ASSIGN_URL  ? 'Configure' : 'Fallback local'}`);
  getPool()
    .then(() => console.log('BDD connectee'))
    .catch(e => console.error('BDD erreur:', e.message));
});

module.exports = app;