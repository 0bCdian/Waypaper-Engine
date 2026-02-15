---
name: redis-best-practices
description: Redis development best practices for caching, data structures, and high-performance key-value operations
---

# Redis Best Practices

## Core Principles

- Use Redis for caching, session storage, real-time analytics, and message queuing
- Choose appropriate data structures for your use case
- Implement proper key naming conventions and expiration policies
- Design for high availability and persistence requirements
- Monitor memory usage and optimize for performance

## Key Naming Conventions

- Use colons as namespace separators
- Include object type and identifier in key names
- Keep keys short but descriptive
- Use consistent naming patterns across your application

```
# Good key naming examples
user:1234:profile
user:1234:sessions
order:5678:items
cache:api:products:list
queue:email:pending
session:abc123def456
rate_limit:api:user:1234
```

## Data Structures

### Strings

- Use for simple key-value storage, counters, and caching
- Consider using MGET/MSET for batch operations

```redis
# Simple caching
SET cache:user:1234 '{"name":"John","email":"john@example.com"}' EX 3600

# Counters
INCR stats:pageviews:homepage
INCRBY stats:downloads:file123 5

# Atomic operations
SETNX lock:resource:456 "owner:abc" EX 30
```

### Hashes

- Use for objects with multiple fields
- More memory-efficient than multiple string keys
- Supports partial updates

```redis
# Store user profile
HSET user:1234 name "John Doe" email "john@example.com" created_at "2024-01-15"

# Get specific fields
HGET user:1234 email
HMGET user:1234 name email

# Increment numeric fields
HINCRBY user:1234 login_count 1

# Get all fields
HGETALL user:1234
```

### Lists

- Use for queues, recent items, and activity feeds
- Consider blocking operations for queue consumers

```redis
# Message queue
LPUSH queue:emails '{"to":"user@example.com","subject":"Welcome"}'
RPOP queue:emails

# Blocking pop for workers
BRPOP queue:emails 30

# Recent activity (keep last 100)
LPUSH user:1234:activity "viewed product 567"
LTRIM user:1234:activity 0 99

# Get recent items
LRANGE user:1234:activity 0 9
```

### Sets

- Use for unique collections, tags, and relationships
- Supports set operations (union, intersection, difference)

```redis
# User tags/interests
SADD user:1234:interests "technology" "music" "travel"

# Check membership
SISMEMBER user:1234:interests "music"

# Find common interests
SINTER user:1234:interests user:5678:interests

# Online users tracking
SADD online:users "user:1234"
SREM online:users "user:1234"
SMEMBERS online:users
```

### Sorted Sets

- Use for leaderboards, priority queues, and time-series data
- Elements sorted by score

```redis
# Leaderboard
ZADD leaderboard:game1 1500 "player:123" 2000 "player:456" 1800 "player:789"

# Get top 10
ZREVRANGE leaderboard:game1 0 9 WITHSCORES

# Get player rank
ZREVRANK leaderboard:game1 "player:123"

# Time-based data (score = timestamp)
ZADD events:user:1234 1705329600 "login" 1705330000 "purchase"

# Get events in time range
ZRANGEBYSCORE events:user:1234 1705329600 1705333200
```

### Streams

- Use for event streaming and log data
- Supports consumer groups for distributed processing

```redis
# Add events to stream
XADD events:orders * customer_id 1234 product_id 567 amount 99.99

# Read from stream
XREAD COUNT 10 STREAMS events:orders 0

# Consumer groups
XGROUP CREATE events:orders order-processors $ MKSTREAM
XREADGROUP GROUP order-processors worker1 COUNT 10 STREAMS events:orders >

# Acknowledge processed messages
XACK events:orders order-processors 1234567890-0
```

## Caching Patterns

### Cache-Aside Pattern

```python
# Pseudo-code for cache-aside
def get_user(user_id):
    # Try cache first
    cached = redis.get(f"cache:user:{user_id}")
    if cached:
        return json.loads(cached)

    # Cache miss - fetch from database
    user = database.get_user(user_id)

    # Store in cache with expiration
    redis.setex(f"cache:user:{user_id}", 3600, json.dumps(user))

    return user
```

### Write-Through Pattern

```python
def update_user(user_id, data):
    # Update database
    database.update_user(user_id, data)

    # Update cache
    redis.setex(f"cache:user:{user_id}", 3600, json.dumps(data))
```

### Cache Invalidation

```redis
# Delete specific cache
DEL cache:user:1234

# Delete by pattern (use with caution in production)
# Use SCAN instead of KEYS for large datasets
SCAN 0 MATCH cache:user:* COUNT 100

# Tag-based invalidation using sets
SADD cache:tags:user:1234 "cache:user:1234:profile" "cache:user:1234:orders"
# Invalidate all related caches
SMEMBERS cache:tags:user:1234
# Then delete each key
```

## Expiration and Memory Management

### TTL Best Practices

- Always set TTL on cache keys
- Use jitter to prevent thundering herd
- Consider sliding expiration for session data

```redis
# Set with expiration
SET cache:data:123 "value" EX 3600

# Set expiration on existing key
EXPIRE cache:data:123 3600

# Check TTL
TTL cache:data:123

# Persist key (remove expiration)
PERSIST cache:data:123
```

### Memory Management

```redis
# Check memory usage
INFO memory

# Get key memory usage
MEMORY USAGE cache:large:object

# Configure max memory policy
CONFIG SET maxmemory 2gb
CONFIG SET maxmemory-policy allkeys-lru
```

## Transactions and Atomicity

### MULTI/EXEC Transactions

```redis
# Transaction block
MULTI
INCR stats:views
LPUSH recent:views "page:123"
EXEC

# Watch for optimistic locking
WATCH user:1234:balance
balance = GET user:1234:balance
MULTI
SET user:1234:balance (balance - 100)
EXEC
```

### Lua Scripts

- Use for complex atomic operations
- Scripts execute atomically

```lua
-- Rate limiting script
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')

if current >= limit then
    return 0
end

redis.call('INCR', key)
if current == 0 then
    redis.call('EXPIRE', key, window)
end

return 1
```

```redis
# Execute Lua script
EVAL "return redis.call('GET', KEYS[1])" 1 mykey
```

## Pub/Sub and Messaging

```redis
# Publisher
PUBLISH channel:notifications '{"type":"alert","message":"New order"}'

# Subscriber
SUBSCRIBE channel:notifications

# Pattern subscription
PSUBSCRIBE channel:*
```

## High Availability

### Replication

- Use replicas for read scaling
- Configure proper persistence on master

```redis
# On replica
REPLICAOF master_host 6379

# Check replication status
INFO replication
```

### Redis Sentinel

- Use for automatic failover
- Deploy at least 3 Sentinel instances

### Redis Cluster

- Use for horizontal scaling
- Data automatically sharded across nodes
- Use hash tags for related keys

```redis
# Hash tags ensure keys go to same slot
SET {user:1234}:profile "data"
SET {user:1234}:settings "data"
```

## Persistence

### RDB Snapshots

```redis
# Manual snapshot
BGSAVE

# Configure automatic snapshots
CONFIG SET save "900 1 300 10 60 10000"
```

### AOF (Append-Only File)

```redis
# Enable AOF
CONFIG SET appendonly yes
CONFIG SET appendfsync everysec

# Rewrite AOF
BGREWRITEAOF
```

## Security

- Require authentication
- Use TLS for connections
- Bind to specific interfaces
- Disable dangerous commands

```redis
# Set password
CONFIG SET requirepass "your_strong_password"

# Authenticate
AUTH your_strong_password

# Rename dangerous commands (in redis.conf)
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command KEYS ""
```

## Monitoring

```redis
# Server info
INFO

# Memory stats
INFO memory

# Client connections
CLIENT LIST

# Slow log
SLOWLOG GET 10

# Monitor commands (debug only)
MONITOR

# Key count per database
INFO keyspace
```

## Connection Management

- Use connection pooling
- Set appropriate timeouts
- Handle reconnection gracefully

```python
# Python example with connection pool
import redis

pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    max_connections=50,
    socket_timeout=5,
    socket_connect_timeout=5
)

redis_client = redis.Redis(connection_pool=pool)
```

## Performance Tips

- Use pipelining for batch operations
- Avoid large keys (>100KB values)
- Use SCAN instead of KEYS in production
- Monitor and optimize memory usage
- Consider using RedisJSON for complex JSON operations

```redis
# Pipeline example (pseudo-code)
pipe = redis.pipeline()
pipe.get("key1")
pipe.get("key2")
pipe.set("key3", "value")
results = pipe.execute()
```
