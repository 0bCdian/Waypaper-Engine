---
name: sql-best-practices
description: SQL development best practices for writing efficient, secure, and maintainable database queries
---

# SQL Best Practices

## Core Principles

- Write clear, readable SQL with consistent formatting and meaningful aliases
- Prioritize query performance through proper indexing and optimization
- Implement security best practices to prevent SQL injection
- Use transactions appropriately for data integrity
- Document complex queries with inline comments

## Query Writing Standards

### Formatting and Style

- Use uppercase for SQL keywords (SELECT, FROM, WHERE, JOIN)
- Place each major clause on a new line for readability
- Use meaningful table aliases (e.g., `customers AS c` not `customers AS x`)
- Indent subqueries and nested conditions consistently
- Align column lists and conditions for visual clarity

```sql
SELECT
    c.customer_id,
    c.customer_name,
    o.order_date,
    o.total_amount
FROM customers AS c
INNER JOIN orders AS o ON c.customer_id = o.customer_id
WHERE o.order_date >= '2024-01-01'
    AND o.status = 'completed'
ORDER BY o.order_date DESC;
```

### Column Selection

- Avoid `SELECT *` in production code; explicitly list required columns
- Use column aliases to clarify output: `SELECT first_name AS "First Name"`
- Consider the order of columns in SELECT for logical grouping

### Filtering and Conditions

- Place most restrictive conditions first in WHERE clauses
- Use appropriate operators: prefer `IN` over multiple `OR` conditions
- Use `EXISTS` instead of `IN` for subqueries when checking existence
- Avoid functions on indexed columns in WHERE clauses when possible
- Use parameterized queries to prevent SQL injection

```sql
-- Preferred: Use EXISTS for existence checks
SELECT c.customer_name
FROM customers AS c
WHERE EXISTS (
    SELECT 1 FROM orders AS o
    WHERE o.customer_id = c.customer_id
    AND o.order_date > '2024-01-01'
);

-- Avoid: Function on indexed column
WHERE YEAR(order_date) = 2024

-- Preferred: Range comparison
WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'
```

## Join Best Practices

- Always use explicit JOIN syntax instead of implicit joins in WHERE
- Specify join type explicitly (INNER, LEFT, RIGHT, FULL OUTER)
- Order joins from largest to smallest table when possible
- Use appropriate join types based on data requirements
- Be cautious with CROSS JOINs; ensure they are intentional

```sql
-- Explicit join (preferred)
SELECT c.name, o.order_id
FROM customers AS c
INNER JOIN orders AS o ON c.customer_id = o.customer_id;

-- Avoid implicit join
SELECT c.name, o.order_id
FROM customers c, orders o
WHERE c.customer_id = o.customer_id;
```

## Performance Optimization

### Indexing Guidelines

- Create indexes on columns used in WHERE, JOIN, and ORDER BY clauses
- Consider composite indexes for multi-column queries
- Avoid over-indexing; each index adds write overhead
- Regularly analyze and maintain indexes
- Use covering indexes for frequently executed queries

### Query Optimization

- Use EXPLAIN/EXPLAIN ANALYZE to understand query execution plans
- Limit result sets with TOP/LIMIT when full results are not needed
- Use pagination for large result sets
- Avoid correlated subqueries when possible; use JOINs instead
- Consider query caching for frequently executed queries

```sql
-- Pagination example
SELECT product_id, product_name, price
FROM products
ORDER BY product_id
LIMIT 20 OFFSET 40;
```

### Aggregation Best Practices

- Filter before grouping when possible (WHERE vs HAVING)
- Use appropriate aggregate functions (COUNT, SUM, AVG, etc.)
- Consider window functions for running totals and rankings

```sql
-- Efficient: Filter before aggregation
SELECT category_id, COUNT(*) AS product_count
FROM products
WHERE active = true
GROUP BY category_id
HAVING COUNT(*) > 10;
```

## Transaction Management

- Keep transactions as short as possible
- Use appropriate isolation levels for your use case
- Always include error handling with ROLLBACK
- Avoid user interaction during open transactions
- Use savepoints for complex multi-step operations

```sql
BEGIN TRANSACTION;

UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE account_id = 2;

IF @@ERROR <> 0
    ROLLBACK TRANSACTION;
ELSE
    COMMIT TRANSACTION;
```

## Security Best Practices

- Always use parameterized queries or prepared statements
- Never concatenate user input directly into SQL strings
- Apply principle of least privilege for database users
- Audit and log sensitive data access
- Encrypt sensitive data at rest and in transit

```sql
-- Use parameterized queries (pseudo-code)
PREPARE stmt FROM 'SELECT * FROM users WHERE username = ?';
EXECUTE stmt USING @username;
```

## Data Modification Best Practices

### INSERT Operations

- Always specify column names explicitly
- Use bulk inserts for multiple rows when possible
- Consider using MERGE/UPSERT for insert-or-update scenarios

```sql
INSERT INTO customers (customer_name, email, created_at)
VALUES
    ('John Doe', 'john@example.com', CURRENT_TIMESTAMP),
    ('Jane Smith', 'jane@example.com', CURRENT_TIMESTAMP);
```

### UPDATE Operations

- Always include a WHERE clause (unless intentionally updating all rows)
- Test UPDATE queries with SELECT first
- Consider using transactions for critical updates

### DELETE Operations

- Always include a WHERE clause
- Use soft deletes (status flags) for recoverable data
- Consider CASCADE effects on related tables

## Naming Conventions

- Use snake_case for table and column names
- Use singular nouns for table names (customer, not customers)
- Prefix primary keys with table name: `customer_id`
- Use descriptive names: `order_total` not `ot`
- Prefix boolean columns appropriately: `is_active`, `has_shipped`

## Documentation

- Comment complex business logic within queries
- Document stored procedures with purpose, parameters, and examples
- Maintain a data dictionary for table and column descriptions
- Version control database schema changes

## Error Handling

- Implement proper error handling in stored procedures
- Log errors with sufficient context for debugging
- Return meaningful error messages to calling applications
- Use TRY-CATCH blocks where supported
