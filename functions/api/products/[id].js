// GET /api/products/[id]
// Obtiene un producto por ID
export async function onRequestGet(context) {
  const { env, params } = context;
  const id = parseInt(params.id, 10);

  if (isNaN(id)) {
    return json({ success: false, error: 'ID inválido' }, 400);
  }

  try {
    const stmt = env.DB.prepare('SELECT * FROM productos WHERE id = ?');
    const result = await stmt.bind(id).first();

    if (!result) {
      return json({ success: false, error: 'Producto no encontrado' }, 404);
    }

    return json({ success: true, producto: result });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
