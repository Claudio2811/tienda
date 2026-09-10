-- Schema para tienda
-- Las tablas se crean en D1 (SQLite)

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  precio INTEGER NOT NULL,  -- en CLP
  imagen TEXT NOT NULL,
  categoria TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  stock INTEGER NOT NULL DEFAULT 100,
  destacado INTEGER NOT NULL DEFAULT 0,  -- 1 = aparece en home
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,  -- ej: PED-20260909-0001
  customer_nombre TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_telefono TEXT NOT NULL,
  customer_direccion TEXT NOT NULL,
  customer_comuna TEXT,
  customer_region TEXT,
  subtotal INTEGER NOT NULL,
  envio INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente, pagado, enviado, entregado, cancelado
  mp_payment_id TEXT,  -- id de Mercado Pago cuando se pague
  mp_preference_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,  -- 1 = pedido demo (no real)
  erp_synced INTEGER NOT NULL DEFAULT 0,
  erp_synced_at TEXT,
  notas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS webhooks_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,  -- 'mercadopago', 'erp'
  direccion TEXT NOT NULL,  -- 'incoming', 'outgoing'
  pedido_id INTEGER,
  payload TEXT,
  response_status INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos(codigo);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_webhooks_pedido ON webhooks_log(pedido_id);
