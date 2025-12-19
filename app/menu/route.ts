import "server-only";

import { productRepository } from "@/app/lib/db/repositories/productRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formatPrice = (price: number, currency: string) => {
  const safeCurrency = currency && currency.trim() ? currency : "ARS";
  return `${safeCurrency} ${price.toLocaleString("en-US")}`;
};

const renderHtml = async () => {
  const products = await productRepository.list();
  const itemsHtml = products
    .map((product) => {
      const notes = product.notes ? `<p class="notes">${product.notes}</p>` : "";
      return `
        <article class="card">
          <header class="card-header">
            <h2>${product.name}</h2>
            <span class="price">${formatPrice(product.price, product.currency)}</span>
          </header>
          ${notes}
          <p class="meta">ID: ${product.id}</p>
        </article>
      `;
    })
    .join("");

  const emptyState = `
    <div class="empty">
      <h2>No hay productos cargados</h2>
      <p>Agrega productos en el back para que aparezcan aca.</p>
    </div>
  `;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Carta</title>
        <style>
          :root {
            color-scheme: light;
            --paper: #f5efe6;
            --ink: #2a2018;
            --accent: #c9793a;
            --card: #fff8ee;
            --muted: #6b5b4a;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: "Georgia", "Times New Roman", serif;
            background: radial-gradient(circle at top, #fff6e8, var(--paper));
            color: var(--ink);
          }
          header.page {
            padding: 48px 20px 24px;
            text-align: center;
          }
          header.page h1 {
            margin: 0;
            font-size: 42px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          header.page p {
            margin: 12px 0 0;
            color: var(--muted);
          }
          main {
            padding: 0 20px 60px;
            max-width: 980px;
            margin: 0 auto;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 20px;
          }
          .card {
            background: var(--card);
            border: 1px solid #e4d4c2;
            border-radius: 18px;
            padding: 20px 18px;
            box-shadow: 0 10px 25px rgba(42, 32, 24, 0.08);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .card:hover {
            transform: translateY(-3px);
            box-shadow: 0 16px 30px rgba(42, 32, 24, 0.12);
          }
          .card-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
          }
          .card h2 {
            margin: 0;
            font-size: 20px;
          }
          .price {
            font-weight: 700;
            color: var(--accent);
          }
          .notes {
            margin: 12px 0 0;
            color: var(--muted);
          }
          .meta {
            margin: 12px 0 0;
            font-size: 12px;
            color: #907965;
          }
          .empty {
            text-align: center;
            padding: 40px 0;
          }
          @media (max-width: 600px) {
            header.page h1 {
              font-size: 32px;
            }
          }
        </style>
      </head>
      <body>
        <header class="page">
          <h1>Carta</h1>
          <p>Todos los productos disponibles.</p>
        </header>
        <main>
          <section class="grid">
            ${products.length ? itemsHtml : emptyState}
          </section>
        </main>
      </body>
    </html>
  `;
};

export async function GET() {
  const html = await renderHtml();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
