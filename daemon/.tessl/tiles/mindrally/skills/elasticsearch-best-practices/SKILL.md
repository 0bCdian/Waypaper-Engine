---
name: elasticsearch-best-practices
description: Elasticsearch development best practices for indexing, querying, and search optimization
---

# Elasticsearch Best Practices

## Core Principles

- Design indices and mappings based on query patterns
- Optimize for search performance with proper analysis and indexing
- Use appropriate shard sizing and cluster configuration
- Implement proper security and access control
- Monitor cluster health and optimize queries

## Index Design

### Mapping Best Practices

- Define explicit mappings instead of relying on dynamic mapping
- Use appropriate data types for each field
- Disable indexing for fields you do not search on
- Use keyword type for exact matches, text for full-text search

```json
{
  "mappings": {
    "properties": {
      "product_id": {
        "type": "keyword"
      },
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100
      },
      "category": {
        "type": "keyword"
      },
      "tags": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date"
      },
      "metadata": {
        "type": "object",
        "enabled": false
      },
      "location": {
        "type": "geo_point"
      }
    }
  }
}
```

### Field Types

- `keyword`: Exact values, filtering, aggregations, sorting
- `text`: Full-text search with analysis
- `date`: Date/time values with format specification
- `numeric types`: long, integer, short, byte, double, float, scaled_float
- `boolean`: True/false values
- `geo_point`: Latitude/longitude pairs
- `nested`: Arrays of objects that need independent querying

### Index Settings

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "analysis": {
      "analyzer": {
        "custom_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "synonym_filter"]
        }
      },
      "filter": {
        "synonym_filter": {
          "type": "synonym",
          "synonyms": ["laptop, notebook", "phone, mobile, smartphone"]
        }
      }
    }
  }
}
```

## Shard Sizing

### Guidelines

- Target 20-40GB per shard
- Aim for ~20 shards per GB of heap
- Avoid oversharding (too many small shards)
- Consider time-based indices for time-series data

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  }
}
```

### Index Lifecycle Management (ILM)

```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "7d"
          }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

## Query Optimization

### Query Types

#### Match Query (Full-text search)

```json
{
  "query": {
    "match": {
      "description": {
        "query": "wireless bluetooth headphones",
        "operator": "and",
        "fuzziness": "AUTO"
      }
    }
  }
}
```

#### Term Query (Exact match)

```json
{
  "query": {
    "term": {
      "status": "active"
    }
  }
}
```

#### Bool Query (Combining queries)

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "laptop" } }
      ],
      "filter": [
        { "term": { "category": "electronics" } },
        { "range": { "price": { "gte": 500, "lte": 2000 } } }
      ],
      "should": [
        { "term": { "brand": "apple" } }
      ],
      "must_not": [
        { "term": { "status": "discontinued" } }
      ]
    }
  }
}
```

### Query Best Practices

- Use `filter` context for non-scoring queries (cacheable)
- Use `must` only when scoring is needed
- Avoid wildcards at the beginning of terms
- Use `keyword` fields for exact matches
- Limit result size with `size` parameter

```json
{
  "query": {
    "bool": {
      "must": {
        "multi_match": {
          "query": "search terms",
          "fields": ["name^3", "description", "tags^2"],
          "type": "best_fields"
        }
      },
      "filter": [
        { "term": { "active": true } },
        { "range": { "created_at": { "gte": "now-30d" } } }
      ]
    }
  },
  "size": 20,
  "from": 0,
  "_source": ["name", "price", "category"]
}
```

## Aggregations

### Common Aggregation Patterns

```json
{
  "size": 0,
  "aggs": {
    "categories": {
      "terms": {
        "field": "category",
        "size": 10
      },
      "aggs": {
        "avg_price": {
          "avg": { "field": "price" }
        }
      }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 100 },
          { "from": 100, "to": 500 },
          { "from": 500 }
        ]
      }
    },
    "date_histogram": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "month"
      }
    }
  }
}
```

### Aggregation Best Practices

- Use `size: 0` when you only need aggregations
- Set appropriate `shard_size` for terms aggregations
- Use composite aggregations for pagination
- Consider using `aggs` filters to narrow scope

## Indexing Best Practices

### Bulk Indexing

```json
POST _bulk
{ "index": { "_index": "products", "_id": "1" } }
{ "name": "Product 1", "price": 99.99 }
{ "index": { "_index": "products", "_id": "2" } }
{ "name": "Product 2", "price": 149.99 }
```

### Bulk API Guidelines

- Use bulk API for batch operations
- Optimal bulk size: 5-15MB per request
- Monitor for rejected requests (thread pool queue full)
- Disable refresh during bulk indexing for better performance

```json
PUT /products/_settings
{
  "refresh_interval": "-1"
}

// After bulk indexing:
PUT /products/_settings
{
  "refresh_interval": "1s"
}

POST /products/_refresh
```

### Document Updates

```json
POST /products/_update/1
{
  "doc": {
    "price": 89.99,
    "updated_at": "2024-01-15T10:30:00Z"
  }
}

// Update by query
POST /products/_update_by_query
{
  "query": {
    "term": { "category": "electronics" }
  },
  "script": {
    "source": "ctx._source.on_sale = true"
  }
}
```

## Analysis and Tokenization

### Custom Analyzers

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "product_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "asciifolding",
            "english_stop",
            "english_stemmer"
          ]
        },
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "edge_ngram_filter"
          ]
        }
      },
      "filter": {
        "english_stop": {
          "type": "stop",
          "stopwords": "_english_"
        },
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        },
        "edge_ngram_filter": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 15
        }
      }
    }
  }
}
```

### Test Analyzer

```json
POST /products/_analyze
{
  "analyzer": "product_analyzer",
  "text": "Wireless Bluetooth Headphones"
}
```

## Search Features

### Autocomplete/Suggestions

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "fields": {
          "suggest": {
            "type": "completion"
          }
        }
      }
    }
  }
}

// Query suggestions
{
  "suggest": {
    "product-suggest": {
      "prefix": "wire",
      "completion": {
        "field": "name.suggest",
        "size": 5
      }
    }
  }
}
```

### Highlighting

```json
{
  "query": {
    "match": { "description": "wireless" }
  },
  "highlight": {
    "fields": {
      "description": {
        "pre_tags": ["<em>"],
        "post_tags": ["</em>"],
        "fragment_size": 150
      }
    }
  }
}
```

## Performance Optimization

### Query Caching

- Filter queries are cached automatically
- Use `filter` context for frequently repeated conditions
- Monitor cache hit rates

### Search Performance

- Avoid deep pagination (use `search_after` instead)
- Limit `_source` fields returned
- Use `doc_values` for sorting and aggregations
- Pre-sort index for common sort orders

```json
{
  "query": { "match_all": {} },
  "size": 20,
  "search_after": [1705329600000, "product_123"],
  "sort": [
    { "created_at": "desc" },
    { "_id": "asc" }
  ]
}
```

## Monitoring and Maintenance

### Cluster Health

```
GET _cluster/health
GET _cat/indices?v
GET _cat/shards?v
GET _nodes/stats
```

### Index Maintenance

```
POST /products/_forcemerge?max_num_segments=1
POST /products/_cache/clear
POST /products/_refresh
```

### Slow Query Log

```json
PUT /products/_settings
{
  "index.search.slowlog.threshold.query.warn": "10s",
  "index.search.slowlog.threshold.query.info": "5s",
  "index.search.slowlog.threshold.fetch.warn": "1s"
}
```

## Security

### Index-Level Security

```json
PUT _security/role/products_reader
{
  "indices": [
    {
      "names": ["products*"],
      "privileges": ["read"]
    }
  ]
}
```

### Field-Level Security

```json
PUT _security/role/limited_access
{
  "indices": [
    {
      "names": ["users"],
      "privileges": ["read"],
      "field_security": {
        "grant": ["name", "email", "created_at"]
      }
    }
  ]
}
```

## Aliases and Reindexing

### Index Aliases

```json
POST _aliases
{
  "actions": [
    { "add": { "index": "products_v2", "alias": "products" } },
    { "remove": { "index": "products_v1", "alias": "products" } }
  ]
}
```

### Reindex with Transformation

```json
POST _reindex
{
  "source": {
    "index": "products_v1"
  },
  "dest": {
    "index": "products_v2"
  },
  "script": {
    "source": "ctx._source.migrated_at = new Date().toString()"
  }
}
```
