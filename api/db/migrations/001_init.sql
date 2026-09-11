CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS sales (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS sale_items (
  sale_id          TEXT NOT NULL REFERENCES sales (id),
  product_id       TEXT NOT NULL REFERENCES products (id),
  sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents >= 0),
  stock            INTEGER NOT NULL CHECK (stock >= 0),
  max_per_user     INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user > 0),
  PRIMARY KEY (sale_id, product_id)
);

CREATE TABLE IF NOT EXISTS sale_allocations (
  sale_id    TEXT NOT NULL,
  product_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  units      INTEGER NOT NULL CHECK (units > 0),
  PRIMARY KEY (sale_id, product_id, user_id),
  FOREIGN KEY (sale_id, product_id) REFERENCES sale_items (sale_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  sale_id     TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (sale_id, product_id) REFERENCES sale_items (sale_id, product_id)
);

CREATE INDEX IF NOT EXISTS orders_sale_user_idx ON orders (sale_id, user_id);
