// Webhook de Mercado Pago
import { json, error } from '../utils.js';

export async function mercadopagoWebhook(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  // Log del webhook entrante
  try {
    await env.DB.prepare(`
      INSERT INTO webhooks_log (tipo, direccion, payload, response_status)
      VALUES ('mercadopago', 'incoming', ?, 200)
    `).bind(JSON.stringify(body)).run();
  } catch {}

  // Procesar notificaciones de pago
  if (body.type === 'payment' && body.data?.id) {
    const paymentId = body.data.id;
    try {
      // Aquí iría la integración real con Mercado Pago:
      // fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      //   headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` }
      // })
      // y actualizar el estado del pedido según el status del pago

      await env.DB.prepare(`
        UPDATE pedidos SET mp_payment_id = ?, updated_at = datetime('now')
        WHERE codigo = ?
      `).bind(paymentId.toString(), body.external_reference || '').run();
    } catch (e) {
      console.error('Error procesando MP webhook:', e);
    }
  }

  return json({ success: true, received: true });
}
