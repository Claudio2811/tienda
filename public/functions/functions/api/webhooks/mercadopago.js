// POST /api/webhooks/mercadopago
// Webhook entrante de Mercado Pago para notificaciones de pago
export async function onRequestPost(context) {
  const { env, request } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'JSON inválido' }, 400);
  }

  // Log
  try {
    await env.DB.prepare(`
      INSERT INTO webhooks_log (tipo, direccion, payload, response_status)
      VALUES ('mercadopago', 'incoming', ?, 200)
    `).bind(JSON.stringify(body)).run();
  } catch {}

  // Procesar notificaciones
  // MP envía: { type, data: { id } }
  if (body.type === 'payment' && body.data?.id) {
    const paymentId = body.data.id;

    // Aquí iría la integración real con Mercado Pago
    // Por ahora solo logueamos
    // Para integración real: fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } })
    // y actualizar el estado del pedido según status

    try {
      await env.DB.prepare(`
        UPDATE pedidos SET mp_payment_id = ?, updated_at = datetime('now')
        WHERE codigo = ?
      `).bind(paymentId.toString(), body.external_reference || '').run();
    } catch {}
  }

  return json({ success: true, received: true });
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
