// /api/orders
// GET = listar pedidos (con filtros)
// POST = crear pedido nuevo
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
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
    return json({ success: false, error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido' }, 400);
  }

  // Validar campos requeridos
  const required = ['customer_nombre', 'customer_email', 'customer_telefono', 'customer_direccion', 'items'];
  for (const field of required) {
    if (!body[field]) {
      return json({ success: false, error: `Campo requerido: ${field}` }, 400);
    }
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ success: false, error: 'items debe ser un array con al menos un producto' }, 400);
  }

  try {
    // Generar código de pedido
    const year = new Date().getFullYear();
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM pedidos WHERE codigo LIKE ?'
    ).bind(`PED-${year}-%`).first();
    const nextNum = (countResult?.total || 0) + 1;
    const codigo = `PED-${year}-${String(nextNum).padStart(4, '0')}`;

    // Calcular totales
    let subtotal = 0;
    const itemsProcessed = [];
    for (const item of body.items) {
      const producto = await env.DB.prepare(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ?'
      ).bind(item.producto_id).first();

      if (!producto) {
        return json({ success: false, error: `Producto ${item.producto_id} no existe` }, 400);
      }
      if (producto.stock < item.cantidad) {
        return json({ success: false, error: `Stock insuficiente para ${producto.nombre}` }, 400);
      }

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

    // Insertar pedido
    const pedidoResult = await env.DB.prepare(`
      INSERT INTO pedidos (codigo, customer_nombre, customer_email, customer_telefono,
        customer_direccion, customer_comuna, customer_region, subtotal, envio, total,
        estado, is_demo, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
    `).bind(
      codigo,
      body.customer_nombre,
      body.customer_email,
      body.customer_telefono,
      body.customer_direccion,
      body.customer_comuna || null,
      body.customer_region || null,
      subtotal,
      envio,
      total,
      isDemo,
      body.notas || null
    ).run();

    const pedidoId = pedidoResult.meta.last_row_id;

    // Insertar items
    for (const item of itemsProcessed) {
      await env.DB.prepare(`
        INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `).bind(pedidoId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal).run();

      // Actualizar stock
      await env.DB.prepare(`
        UPDATE productos SET stock = stock - ? WHERE id = ?
      `).bind(item.cantidad, item.producto_id).run();
    }

    // Si hay URL de ERP configurada, enviar webhook
    const erpUrl = env.ERP_WEBHOOK_URL;
    if (erpUrl) {
      try {
        const erpPayload = {
          evento: 'pedido.creado',
          pedido: {
            id: pedidoId,
            codigo: codigo,
            customer: {
              nombre: body.customer_nombre,
              email: body.customer_email,
              telefono: body.customer_telefono,
              direccion: body.customer_direccion,
              comuna: body.customer_comuna,
              region: body.customer_region
            },
            items: itemsProcessed,
            subtotal: subtotal,
            envio: envio,
            total: total,
            notas: body.notas,
            is_demo: isDemo === 1,
            created_at: new Date().toISOString()
          }
        };

        // Disparar webhook sin esperar (background)
        context.waitUntil(
          fetch(erpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(erpPayload)
          }).then(r => {
            return env.DB.prepare(`
              INSERT INTO webhooks_log (tipo, direccion, pedido_id, payload, response_status)
              VALUES ('erp', 'outgoing', ?, ?, ?)
            `).bind(pedidoId, JSON.stringify(erpPayload), r.status).run();
          }).catch(e => {
            return env.DB.prepare(`
              INSERT INTO webhooks_log (tipo, direccion, pedido_id, payload, response_body)
              VALUES ('erp', 'outgoing', ?, ?, ?)
            `).bind(pedidoId, JSON.stringify(erpPayload), e.message).run();
          })
        );
      } catch (e) {
        // Log error pero no fallar el pedido
        console.error('Error ERP webhook:', e);
      }
    }

    return json({
      success: true,
      pedido: {
        id: pedidoId,
        codigo: codigo,
        customer_nombre: body.customer_nombre,
        customer_email: body.customer_email,
        items: itemsProcessed,
        subtotal: subtotal,
        envio: envio,
        total: total,
        estado: 'pendiente',
        is_demo: isDemo === 1,
        created_at: new Date().toISOString()
      }
    }, 201);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
