// GET /api/orders/[codigo]
// Obtiene un pedido específico por código con todos sus items
export async function onRequestGet(context) {
  const { env, params } = context;
  const codigo = params.codigo;

  try {
    const pedido = await env.DB.prepare(`
      SELECT * FROM pedidos WHERE codigo = ?
    `).bind(codigo).first();

    if (!pedido) {
      return json({ success: false, error: 'Pedido no encontrado' }, 404);
    }

    const items = await env.DB.prepare(`
      SELECT pi.*, p.nombre as producto_nombre, p.imagen as producto_imagen, p.sku as producto_sku
      FROM pedido_items pi
      LEFT JOIN productos p ON p.id = pi.producto_id
      WHERE pi.pedido_id = ?
    `).bind(pedido.id).all();

    return json({
      success: true,
      pedido: { ...pedido, items: items.results }
    });
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
