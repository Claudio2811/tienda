// GET /api/products
// Lista productos con filtros opcionales
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const categoria = url.searchParams.get('categoria');
  const destacado = url.searchParams.get('destacado');
  const q = url.searchParams.get('q');

  let sql = 'SELECT id, nombre, descripcion, precio, imagen, categoria, sku, stock, destacado FROM productos WHERE 1=1';
  const params = [];

  if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
  if (destacado === '1') { sql += ' AND destacado = 1'; }
  if (q) { sql += ' AND (nombre LIKE ? OR descripcion LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

  sql += ' ORDER BY destacado DESC, id ASC';

  try {
    const stmt = env.DB.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    return json({ success: true, count: result.results.length, productos: result.results });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key'
    }
  });
}
