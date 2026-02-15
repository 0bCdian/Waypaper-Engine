---
name: mysql-best-practices
description: MySQL development best practices for schema design, query optimization, and database administration
---

# MySQL Best Practices

## Core Principles

- Design schemas with appropriate storage engines (InnoDB for most use cases)
- Optimize queries using EXPLAIN and proper indexing
- Use proper data types to minimize storage and improve performance
- Implement connection pooling and query caching appropriately
- Follow MySQL-specific security hardening practices

## Schema Design

### Storage Engine Selection

- Use InnoDB as the default engine (ACID compliant, row-level locking)
- Consider MyISAM only for read-heavy, non-transactional workloads
- Use MEMORY engine for temporary tables with high-speed requirements

```sql
CREATE TABLE orders (
    order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12, 2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled')
        NOT NULL DEFAULT 'pending',
    INDEX idx_customer (customer_id),
    INDEX idx_date_status (order_date, status),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Data Types

- Use smallest data type that fits your needs
- Prefer INT UNSIGNED over BIGINT when possible
- Use DECIMAL for financial calculations, not FLOAT/DOUBLE
- Use ENUM for fixed sets of values
- Use VARCHAR for variable-length strings, CHAR for fixed-length
- Always use utf8mb4 charset for full Unicode support

```sql
-- Appropriate data type selection
CREATE TABLE products (
    product_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    weight DECIMAL(8, 3),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sku (sku)
) ENGINE=InnoDB;
```

### Primary Keys

- Use AUTO_INCREMENT integer primary keys for InnoDB tables
- Consider UUIDs stored as BINARY(16) for distributed systems
- Avoid composite primary keys when possible

```sql
-- UUID storage optimization
CREATE TABLE distributed_events (
    event_id BINARY(16) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert with UUID
INSERT INTO distributed_events (event_id, event_type, payload)
VALUES (UUID_TO_BIN(UUID()), 'user_signup', '{"user_id": 123}');

-- Query with UUID
SELECT * FROM distributed_events
WHERE event_id = UUID_TO_BIN('550e8400-e29b-41d4-a716-446655440000');
```

## Indexing Strategies

### Index Types

- Use B-tree indexes (default) for most queries
- Use FULLTEXT indexes for text search
- Use SPATIAL indexes for geographic data
- Consider covering indexes for frequently executed queries

```sql
-- Composite index for common query patterns
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);

-- Covering index
CREATE INDEX idx_orders_covering ON orders(customer_id, order_date, status, total_amount);

-- Fulltext index for search
ALTER TABLE products ADD FULLTEXT INDEX ft_name_desc (name, description);

-- Search using fulltext
SELECT * FROM products
WHERE MATCH(name, description) AGAINST('wireless bluetooth' IN NATURAL LANGUAGE MODE);
```

### Index Guidelines

- Index columns used in WHERE, JOIN, ORDER BY, and GROUP BY
- Place most selective columns first in composite indexes
- Avoid indexing low-cardinality columns alone
- Monitor and remove unused indexes

```sql
-- Check index usage
SELECT
    table_schema, table_name, index_name,
    seq_in_index, column_name, cardinality
FROM information_schema.STATISTICS
WHERE table_schema = 'your_database'
ORDER BY table_name, index_name, seq_in_index;
```

## Query Optimization

### EXPLAIN Analysis

- Use EXPLAIN to analyze query execution plans
- Look for full table scans (type: ALL)
- Check for proper index usage
- Monitor rows examined vs rows returned

```sql
EXPLAIN FORMAT=JSON
SELECT c.name, COUNT(o.order_id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE c.created_at > '2024-01-01'
GROUP BY c.customer_id;
```

### Query Best Practices

- Avoid SELECT * in production code
- Use LIMIT for pagination
- Prefer JOINs over subqueries when possible
- Use prepared statements for repeated queries

```sql
-- Efficient pagination
SELECT order_id, order_date, total_amount
FROM orders
WHERE customer_id = ?
ORDER BY order_date DESC
LIMIT 20 OFFSET 0;

-- Keyset pagination (more efficient for large offsets)
SELECT order_id, order_date, total_amount
FROM orders
WHERE customer_id = ?
    AND (order_date, order_id) < (?, ?)
ORDER BY order_date DESC, order_id DESC
LIMIT 20;
```

### Avoiding Common Pitfalls

```sql
-- Avoid: Function on indexed column
SELECT * FROM orders WHERE YEAR(order_date) = 2024;

-- Preferred: Range comparison
SELECT * FROM orders
WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01';

-- Avoid: Implicit type conversion
SELECT * FROM users WHERE user_id = '123';  -- user_id is INT

-- Preferred: Proper types
SELECT * FROM users WHERE user_id = 123;

-- Avoid: LIKE with leading wildcard
SELECT * FROM products WHERE name LIKE '%phone%';

-- Preferred: Fulltext search for text matching
SELECT * FROM products WHERE MATCH(name) AGAINST('phone');
```

## JSON Support

- Use JSON data type for semi-structured data (MySQL 5.7+)
- Create generated columns for frequently accessed JSON fields
- Use appropriate JSON functions for queries

```sql
CREATE TABLE events (
    event_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    -- Generated column for indexing
    user_id INT UNSIGNED AS (payload->>'$.user_id') STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Query JSON data
SELECT event_id, event_type,
       JSON_EXTRACT(payload, '$.action') AS action
FROM events
WHERE JSON_EXTRACT(payload, '$.user_id') = 123;

-- Or using -> operator
SELECT * FROM events WHERE payload->'$.user_id' = 123;
```

## Transaction Management

- Use InnoDB for transactional tables
- Keep transactions short to minimize lock contention
- Choose appropriate isolation level
- Handle deadlocks gracefully

```sql
-- Transaction with error handling
START TRANSACTION;

UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE account_id = 2;

-- Check for errors and commit or rollback
COMMIT;

-- Set isolation level
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

## Replication and High Availability

### Read Replicas

- Direct read queries to replicas
- Use connection pooling with read/write splitting
- Monitor replication lag

```sql
-- Check replication status
SHOW SLAVE STATUS\G

-- Check replication lag
SELECT TIMESTAMPDIFF(SECOND,
    MAX(LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP),
    NOW()) AS lag_seconds
FROM performance_schema.replication_applier_status_by_worker;
```

## Security

- Use strong passwords and secure connections (SSL/TLS)
- Apply principle of least privilege
- Use prepared statements to prevent SQL injection
- Audit sensitive operations

```sql
-- Create user with limited privileges
CREATE USER 'app_user'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON mydb.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

-- Require SSL
ALTER USER 'app_user'@'%' REQUIRE SSL;

-- View user privileges
SHOW GRANTS FOR 'app_user'@'%';
```

## Maintenance

### Regular Maintenance Tasks

```sql
-- Analyze tables for optimizer statistics
ANALYZE TABLE orders, customers, products;

-- Optimize tables (reclaim space, defragment)
OPTIMIZE TABLE orders;

-- Check table integrity
CHECK TABLE orders;
```

### Monitoring Queries

```sql
-- Find slow queries
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;

-- Current process list
SHOW FULL PROCESSLIST;

-- InnoDB status
SHOW ENGINE INNODB STATUS;

-- Table sizes
SELECT
    table_name,
    ROUND(data_length / 1024 / 1024, 2) AS data_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_mb,
    table_rows
FROM information_schema.TABLES
WHERE table_schema = 'your_database'
ORDER BY data_length DESC;
```

## Configuration Recommendations

```ini
# my.cnf recommended settings

[mysqld]
# InnoDB settings
innodb_buffer_pool_size = 70%_of_RAM
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 1
innodb_flush_method = O_DIRECT

# Connection settings
max_connections = 500
wait_timeout = 300
interactive_timeout = 300

# Query cache (disabled in MySQL 8.0+)
query_cache_type = 0

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```
