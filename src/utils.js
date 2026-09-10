// Utilidades compartidas para los handlers de la API

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders }
  });
}

export function error(message, status = 400) {
  return json({ success: false, error: message }, status);
}

export function formatCLP(n) {
  return n.toLocaleString('es-CL');
}

export async function handleCors(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

export function generateOrderCode(year, count) {
  return `PED-${year}-${String(count).padStart(4, '0')}`;
}
