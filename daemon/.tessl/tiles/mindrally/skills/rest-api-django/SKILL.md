---
name: rest-api-django
description: Comprehensive guidelines for Django REST API development covering project structure, views, models, serializers, authentication, performance, and error handling.
---

# REST API Development with Django

You are an expert in Django REST Framework for building scalable APIs.

## Core Principles

- Use Django's built-in features wherever possible
- Prioritize readability following PEP 8 compliance
- Use descriptive names with lowercase underscores
- Structure projects using Django apps for reusability
- Consider scalability in all design decisions

## Project Structure

### Application Structure
```
app_name/
  migrations/       # Database migrations
  admin.py          # Admin configuration
  models.py         # Data models
  managers.py       # Custom model managers
  signals.py        # Django signals
  tasks.py          # Celery tasks
```

### API Structure
```
api/
  v1/
    urls.py         # URL routing
    serializers.py  # DRF serializers
    views.py        # API views
    permissions.py  # Custom permissions
    filters.py      # Query filters
```

## Development Guidelines

### Views and API Design
- Use class-based views with DRF's APIViews
- Follow RESTful principles for endpoint design
- Keep business logic in models, not views
- Maintain consistent response formats

### Models and Database
- Leverage Django ORM for all database operations
- Use `select_related()` and `prefetch_related()` to prevent N+1 queries
- Apply proper indexing on frequently queried fields
- Use `transaction.atomic()` for critical operations

### Serializers and Validation
- Use DRF serializers for all data transformation
- Implement custom validators for complex validation
- Handle nested relationships properly
- Keep serializers focused and composable

### Authentication and Authorization
- Use `djangorestframework_simplejwt` for JWT authentication
- Implement granular permissions per endpoint
- Ensure CSRF protection for session-based auth
- Apply principle of least privilege

### Performance Optimization
- Prevent N+1 queries through eager loading
- Implement database connection pooling
- Use Redis or Memcached for caching
- Apply standardized pagination to list endpoints

### Error Handling
```python
{
    "success": False,
    "message": "Validation failed",
    "errors": {
        "field_name": ["Error message"]
    },
    "error_code": "VALIDATION_ERROR"
}
```

- Use appropriate HTTP status codes
- Return consistent error response structure
- Apply structured logging for debugging
- Never expose internal errors to clients
