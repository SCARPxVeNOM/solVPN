CREATE TABLE IF NOT EXISTS nodes (
  node_pubkey TEXT PRIMARY KEY,
  operator_pubkey TEXT,
  wg_pubkey TEXT,
  ip TEXT,
  price_per_mb BIGINT,
  stake BIGINT,
  registered_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS node_metrics (
  id SERIAL PRIMARY KEY,
  node_pubkey TEXT REFERENCES nodes(node_pubkey),
  ts TIMESTAMP DEFAULT now(),
  bytes_served BIGINT,
  uptime BOOLEAN,
  latency_ms INT
);

CREATE TABLE IF NOT EXISTS node_reputation (
  node_pubkey TEXT PRIMARY KEY,
  reputation FLOAT,
  last_updated TIMESTAMP
);

CREATE INDEX idx_node_metrics_node ON node_metrics(node_pubkey);
CREATE INDEX idx_node_metrics_ts ON node_metrics(ts);

