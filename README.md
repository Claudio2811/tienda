# Tienda — E-commerce con Cloudflare Pages + Workers + D1

E-commerce de demostración con productos físicos, carrito persistente, checkout, Mercado Pago (sandbox-ready) y API REST para integraciones externas.

## Stack

- **Frontend**: HTML/CSS/JS estático en Cloudflare Pages
- **Backend**: Cloudflare Pages Functions (Workers)
- **Base de datos**: Cloudflare D1 (SQLite)
- **Pagos**: Mercado Pago (integración lista, falta credenciales)
- **ERP**: Webhook configurable para envío de pedidos en JSON

## Estructura

```
tienda/
├── public/                  # Archivos estáticos servidos por Pages
│   ├── index.html
│   ├── productos.html
│   ├── producto.html
│   ├── carrito.html
│   ├── checkout.html
│   ├── gracias.html
│   ├── api-docs.html
│   ├── styles.css
│   └── app.js
├── functions/               # Cloudflare Pages Functions
│   └── api/
│       ├── products/
│       │   ├── index.js      # GET /api/products
│       │   └── [id].js       # GET /api/products/:id
│       ├── orders/
│       │   ├── index.js      # GET /api/orders, POST /api/orders
│       │   └── [codigo].js   # GET /api/orders/:codigo
│       └── webhooks/
│           ├── mercadopago.js
│           └── erp.js
├── schema.sql               # Schema D1
├── seed.sql                 # Datos de muestra
├── wrangler.toml            # Configuración Cloudflare
└── .github/workflows/       # Deploy automático
```

## Endpoints

- `GET /api/products` — Listar productos
- `GET /api/products/:id` — Detalle
- `GET /api/orders` — Listar pedidos
- `GET /api/orders/:codigo` — Detalle
- `POST /api/orders` — Crear pedido
- `POST /api/webhooks/mercadopago` — Webhook entrante
- `POST /api/webhooks/erp` — Webhook saliente (cuando hay nuevo pedido)

Ver `/api-docs.html` para documentación interactiva.

## Configuración

### Variables de entorno (Cloudflare Pages)

| Variable | Descripción |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token con Pages:Edit + D1:Edit |
| `CLOUDFLARE_ACCOUNT_ID` | ID de tu cuenta Cloudflare |
| `ERP_WEBHOOK_URL` | (opcional) URL para enviar pedidos en JSON a tu ERP |
| `MP_ACCESS_TOKEN` | (opcional) Token de Mercado Pago para pagos reales |

## Modo demo

Agregar `?demo=1` a cualquier URL:
- Banner amarillo visible
- Pedidos se marcan como `is_demo: true` en la base de datos
- Stock NO se descuenta
- Webhook ERP recibe el flag `is_demo: true`
- Pagos no se procesan (solo simulación)

## Desarrollo local

Requiere Node.js + Wrangler:
```bash
npm install -g wrangler
wrangler d1 execute tienda-db --file=schema.sql --local
wrangler pages dev public --d1=DB=tienda-db
```

## Deploy

Push a `main` → deploy automático a Cloudflare Pages.
