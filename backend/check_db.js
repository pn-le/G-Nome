const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.jnuagbsnsvhytqffjhkt:Nhaphuong16!123@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("SELECT * FROM reports LIMIT 1");
  console.log(res.rows);
  await client.end();
}
main();
