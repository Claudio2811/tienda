// Tienda - Worker principal
// Sirve HTML estático via ASSETS binding y maneja API REST + D1

import { handleCors, error } from './utils.js';
import { listProducts, getProduct } from './api/products.js';
import { listOrders, getOrder, createOrder } from './api/orders.js';
import { mercadopagoWebhook } from './webhooks/mercadopago.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    const corsResponse = await handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ============ RUTAS API ============
    try {
      // /api/products
      if (path === '/api/products' && method === 'GET') {
        return await listProducts(request, env, url);
      }
      // /api/products/[id]
      const productMatch = path.match(/^\/api\/products\/(\d+)$/);
      if (productMatch && method === 'GET') {
        return await getProduct(request, env, parseInt(productMatch[1], 10));
      }
      // /api/orders
      if (path === '/api/orders' && method === 'GET') {
        return await listOrders(request, env, url);
      }
      if (path === '/api/orders' && method === 'POST') {
        return await createOrder(request, env, ctx);
      }
      // /api/orders/[codigo]
      const orderMatch = path.match(/^\/api\/orders\/([A-Z0-9\-]+)$/);
      if (orderMatch && method === 'GET') {
        return await getOrder(request, env, orderMatch[1]);
      }
      // /api/webhooks/mercadopago
      if (path === '/api/webhooks/mercadopago' && method === 'POST') {
        return await mercadopagoWebhook(request, env);
      }
    } catch (err) {
      console.error('API error:', err);
      return error('Error interno: ' + err.message, 500);
    }

    // 404 para rutas API desconocidas
    if (path.startsWith('/api/')) {
      return error('Endpoint no encontrado', 404);
    }

    // ============ ARCHIVOS ESTÁTICOS ============
    // Servir desde ASSETS binding
    let asset = await env.ASSETS.fetch(request);
    if (asset.ok) return asset;

    // Si no se encontró y la URL no tiene extensión, intentar con .html
    if (!asset.ok && !path.includes('.') && path !== '/') {
      const htmlUrl = new URL(path + '.html' + url.search, url);
      const htmlAsset = await env.ASSETS.fetch(new Request(htmlUrl, request));
      if (htmlAsset.ok) return htmlAsset;
    }

    // Fallback a index.html para rutas sin extensión
    if (!path.includes('.')) {
      const indexAsset = await env.ASSETS.fetch(new URL('/index.html', url));
      if (indexAsset.ok) return indexAsset;
    }

    return new Response('Not Found', { status: 404 });
  }
};
