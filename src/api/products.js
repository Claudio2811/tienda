// API de productos
import { json, error } from '../utils.js';

export async function listProducts(request, env, url) {
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
    const result = params.length > 0
      ? await stmt.bind(...params).all()
      : await stmt.all();
    return json({ success: true, count: result.results.length, productos: result.results });
  } catch (err) {
    return error('Error al listar productos: ' + err.message, 500);
  }
}

export async function getProduct(request, env, id) {
  if (isNaN(id)) {
    return error('ID inválido');
  }
  try {
    const result = await env.DB.prepare('SELECT * FROM productos WHERE id = ?').bind(id).first();
    if (!result) {
      return error('Producto no encontrado', 404);
    }
    return json({ success: true, producto: result });
  } catch (err) {
    return error('Error al obtener producto: ' + err.message, 500);
  }
}
