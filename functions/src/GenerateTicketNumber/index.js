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
    const db = await getPool();
    const year = new Date().getFullYear();
    const result = await db.request()
      .input('year', sql.Int, year)
      .query(
        DECLARE @count INT;
        SELECT @count = COUNT(*) + 1 FROM Tickets WITH (UPDLOCK, HOLDLOCK)
        WHERE YEAR(date_creation) = @year;
        SELECT 'TKT-' + CAST(@year AS NVARCHAR(4)) + '-' +
        RIGHT('0000' + CAST(@count AS NVARCHAR(4)), 4) AS reference, @count AS numero;
      );
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        reference: result.recordset[0].reference,
        numero: result.recordset[0].numero,
        year: year,
        generated_at: new Date().toISOString()
      }
    };
  } catch (e) {
    context.log.error('Erreur:', e.message);
    context.res = { status: 500, body: { error: e.message } };
  }
};
