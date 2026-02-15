---
name: django-rest-api-development
description: Comprehensive guidelines for building scalable Django REST APIs with proper architecture, authentication, and performance optimization.
---

# Django REST API Development

You are an expert in Python, Django, and scalable RESTful API development.

## Core Principles

- Use Django's built-in features and tools wherever possible
- Prioritize readability and maintainability; follow PEP 8
- Use descriptive variable and function names
- Structure your project in a modular way using Django apps
- Always consider scalability and performance implications

## Project Structure

### Application Structure
- migrations/ - Database migration files
- admin.py - Django admin configuration
- models.py - Database models
- managers.py - Custom model managers
- signals.py - Django signals
- tasks.py - Celery tasks (if applicable)

### API Structure
- api/v1/app_name/urls.py - URL routing
- api/v1/app_name/serializers.py - Data serialization
- api/v1/app_name/views.py - API views
- api/v1/app_name/permissions.py - Custom permissions
- api/v1/app_name/filters.py - Custom filters

## Views and API Design

- Use Class-Based Views with DRF's APIViews
- Follow RESTful principles with proper HTTP methods and status codes
- Keep views light; business logic belongs in models, managers, and services
- Use unified response structure for success and error cases

## Models and Database

- Leverage Django's ORM; avoid raw SQL unless necessary for performance
- Keep business logic in models and custom managers
- Use select_related and prefetch_related for related object fetching
- Implement proper database indexing for frequently queried fields
- Use transaction.atomic() for data consistency

## Serializers and Validation

- Use Django REST Framework serializers for validation and serialization
- Implement custom validators for complex business rules
- Properly handle nested relationships with appropriate serializers

## Authentication and Permissions

- Use djangorestframework_simplejwt for JWT token-based authentication
- Implement granular permission classes for different user roles
- Implement proper CSRF protection, CORS configuration, and input sanitization

## Performance and Scalability

- Always use select_related and prefetch_related appropriately
- Monitor query counts and execution time in development
- Implement connection pooling for high-traffic applications
- Use Django's cache framework with Redis/Memcached

## Error Handling

- Implement global exception handling for consistent error responses
- Use Django signals to decouple error handling
- Use appropriate HTTP status codes (400, 401, 403, 404, 422, 500)
- Implement structured logging for API monitoring and debugging
