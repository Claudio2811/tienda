// API de pedidos
import { json, error, generateOrderCode } from '../utils.js';

export async function listOrders(request, env, url) {
  const codigo = url.searchParams.get('codigo');
  const estado = url.searchParams.get('estado');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  let sql = `SELECT p.id, p.codigo, p.customer_nombre, p.customer_email, p.customer_telefono,
    p.subtotal, p.envio, p.total, p.estado, p.is_demo, p.created_at,
    (SELECT COUNT(*) FROM pedido_items WHERE pedido_id = p.id) as item_count
    FROM pedidos p WHERE 1=1`;
  const params = [];

  if (codigo) { sql += ' AND p.codigo = ?'; params.push(codigo); }
  if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
  sql += ' ORDER BY p.id DESC LIMIT ?';
  params.push(limit);

  try {
    const result = await env.DB.prepare(sql).bind(...params).all();
    return json({ success: true, count: result.results.length, pedidos: result.results });
  } catch (err) {
    return error('Error al listar pedidos: ' + err.message, 500);
  }
}

export async function getOrder(request, env, codigo) {
  try {
    const pedido = await env.DB.prepare('SELECT * FROM pedidos WHERE codigo = ?').bind(codigo).first();
    if (!pedido) {
      return error('Pedido no encontrado', 404);
    }
    const items = await env.DB.prepare(`
      SELECT pi.*, p.nombre as producto_nombre, p.imagen as producto_imagen, p.sku as producto_sku
      FROM pedido_items pi
      LEFT JOIN productos p ON p.id = pi.producto_id
      WHERE pi.pedido_id = ?
    `).bind(pedido.id).all();
    return json({ success: true, pedido: { ...pedido, items: items.results } });
  } catch (err) {
    return error('Error al obtener pedido: ' + err.message, 500);
  }
}

export async function createOrder(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const required = ['customer_nombre', 'customer_email', 'customer_telefono', 'customer_direccion', 'items'];
  for (const field of required) {
    if (!body[field]) return error(`Campo requerido: ${field}`);
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return error('items debe ser un array con al menos un producto');
  }

  try {
    // Generar código único
    const year = new Date().getFullYear();
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM pedidos WHERE codigo LIKE ?'
    ).bind(`PED-${year}-%`).first();
    const codigo = generateOrderCode(year, (countResult?.total || 0) + 1);

    // Calcular totales
    let subtotal = 0;
    const itemsProcessed = [];
    for (const item of body.items) {
      const producto = await env.DB.prepare(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ?'
      ).bind(item.producto_id).first();

      if (!producto) return error(`Producto ${item.producto_id} no existe`);
      if (producto.stock < item.cantidad) return error(`Stock insuficiente para ${producto.nombre}`);

      const itemSubtotal = producto.precio * item.cantidad;
      subtotal += itemSubtotal;
      itemsProcessed.push({
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: producto.precio,
        subtotal: itemSubtotal
      });
    }

    const envio = body.envio ?? 0;
    const total = subtotal + envio;
    const isDemo = body.is_demo === true ? 1 : 0;

    // Crear pedido
    const pedidoResult = await env.DB.prepare(`
      INSERT INTO pedidos (codigo, customer_nombre, customer_email, customer_telefono,
        customer_direccion, customer_comuna, customer_region, subtotal, envio, total,
        estado, is_demo, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
    `).bind(
      codigo, body.customer_nombre, body.customer_email, body.customer_telefono,
      body.customer_direccion, body.customer_comuna || null, body.customer_region || null,
      subtotal, envio, total, isDemo, body.notas || null
    ).run();

    const pedidoId = pedidoResult.meta.last_row_id;

    // Items + actualizar stock (solo si NO es demo)
    if (isDemo === 0) {
      for (const item of itemsProcessed) {
        await env.DB.prepare(`
          INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `).bind(pedidoId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal).run();
        await env.DB.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
          .bind(item.cantidad, item.producto_id).run();
      }
    } else {
      // Demo: solo registrar los items pero sin descontar stock
      for (const item of itemsProcessed) {
        await env.DB.prepare(`
          INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `).bind(pedidoId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal).run();
      }
    }

    // Webhook ERP saliente (background)
    const erpUrl = env.ERP_WEBHOOK_URL;
    if (erpUrl) {
      const erpPayload = {
        evento: 'pedido.creado',
        pedido: {
          id: pedidoId, codigo,
          customer: {
            nombre: body.customer_nombre, email: body.customer_email,
            telefono: body.customer_telefono, direccion: body.customer_direccion,
            comuna: body.customer_comuna, region: body.customer_region
          },
          items: itemsProcessed, subtotal, envio, total, notas: body.notas,
          is_demo: isDemo === 1,
          created_at: new Date().toISOString()
        }
      };
      ctx.waitUntil(
        fetch(erpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(erpPayload)
        }).then(r => env.DB.prepare(`
          INSERT INTO webhooks_log (tipo, direccion, pedido_id, payload, response_status)
          VALUES ('erp', 'outgoing', ?, ?, ?)
        `).bind(pedidoId, JSON.stringify(erpPayload), r.status).run()
        ).catch(e => console.error('ERP webhook error:', e))
      );
    }

    return json({
      success: true,
      pedido: {
        id: pedidoId, codigo,
        customer_nombre: body.customer_nombre, customer_email: body.customer_email,
        items: itemsProcessed, subtotal, envio, total,
        estado: 'pendiente', is_demo: isDemo === 1,
        created_at: new Date().toISOString()
      }
    }, 201);
  } catch (err) {
    return error('Error al crear pedido: ' + err.message, 500);
  }
}
