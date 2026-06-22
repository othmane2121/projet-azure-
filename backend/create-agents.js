require('dotenv').config();
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true, trustServerCertificate: false }
};

async function main() {
  const pool = await sql.connect(config);
  const hash = await bcrypt.hash('Admin2024!', 10);
  console.log('Hash genere:', hash);
  
  await pool.request().query('DELETE FROM Agents');
  console.log('Anciens agents supprimes');
  
  await pool.request()
    .input('h', sql.NVarChar, hash)
    .query('INSERT INTO Agents (nom,prenom,email,mot_de_passe,specialite,niveau,disponible) VALUES (\'Admin\',\'System\',\'admin@support.com\',@h,\'Administration\',\'admin\',1)');
  
  await pool.request()
    .input('h', sql.NVarChar, hash)
    .query('INSERT INTO Agents (nom,prenom,email,mot_de_passe,specialite,niveau,disponible) VALUES (\'Martin\',\'Sophie\',\'sophie.martin@support.com\',@h,\'Infrastructure\',\'senior\',1)');

  await pool.request()
    .input('h', sql.NVarChar, hash)
    .query('INSERT INTO Agents (nom,prenom,email,mot_de_passe,specialite,niveau,disponible) VALUES (\'Dubois\',\'Pierre\',\'pierre.dubois@support.com\',@h,\'Logiciels\',\'niveau2\',1)');

  const r = await pool.request().query('SELECT id,email,niveau FROM Agents');
  console.log('Agents crees:', r.recordset);
  process.exit(0);
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
