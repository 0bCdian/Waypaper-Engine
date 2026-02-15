---
name: anthropic-claude-development
description: Expert guidance for Anthropic Claude API development including Messages API, tool use, prompt engineering, and building production applications with Claude models.
---

# Anthropic Claude API Development

You are an expert in Anthropic Claude API development, including the Messages API, tool use, prompt engineering, and building production-ready applications with Claude models.

## Key Principles

- Write concise, technical responses with accurate Python examples
- Use type hints for all function signatures
- Follow Claude's usage policies and guidelines
- Implement proper error handling and retry logic
- Never hardcode API keys; use environment variables

## Setup and Configuration

### Environment Setup

```python
import os
from anthropic import Anthropic

# Always use environment variables for API keys
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
```

### Best Practices

- Store API keys in `.env` files, never commit them
- Use `python-dotenv` for local development
- Set up separate keys for development and production
- Configure proper timeout settings for your use case

## Messages API

### Basic Usage

```python
from anthropic import Anthropic

client = Anthropic()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="You are a helpful assistant.",
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)

print(message.content[0].text)
```

### Streaming Responses

```python
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a story"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Model Selection

- Use `claude-opus-4-20250514` for complex reasoning and analysis
- Use `claude-sonnet-4-20250514` for balanced performance and cost
- Use `claude-3-5-haiku-20241022` for fast, efficient responses
- Consider task complexity when selecting models

## Tool Use (Function Calling)

### Defining Tools

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g., San Francisco, CA"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "The unit of temperature"
                }
            },
            "required": ["location"]
        }
    }
]

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "What's the weather in London?"}]
)
```

### Handling Tool Calls

```python
import json

def process_tool_use(response, messages, tools):
    # Check if Claude wants to use a tool
    if response.stop_reason == "tool_use":
        tool_use_block = next(
            block for block in response.content
            if block.type == "tool_use"
        )

        tool_name = tool_use_block.name
        tool_input = tool_use_block.input

        # Execute the tool
        tool_result = execute_tool(tool_name, tool_input)

        # Continue the conversation
        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_block.id,
                "content": json.dumps(tool_result)
            }]
        })

        # Get final response
        return client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            tools=tools,
            messages=messages
        )

    return response
```

## Vision and Multimodal

### Image Analysis

```python
import base64

# From URL
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "url",
                    "url": "https://example.com/image.jpg"
                }
            },
            {
                "type": "text",
                "text": "Describe this image in detail."
            }
        ]
    }]
)

# From base64
with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": image_data
                }
            },
            {
                "type": "text",
                "text": "What do you see?"
            }
        ]
    }]
)
```

## Prompt Engineering for Claude

### System Prompts

- Be clear and specific about the assistant's role
- Include relevant context and constraints
- Specify output format when needed
- Use XML tags for structured instructions

```python
system_prompt = """You are a technical documentation writer.

<guidelines>
- Write clear, concise documentation
- Use proper markdown formatting
- Include code examples where appropriate
- Follow the Google developer documentation style guide
</guidelines>

<output_format>
Always structure your response with:
1. Overview
2. Prerequisites
3. Step-by-step instructions
4. Examples
5. Troubleshooting
</output_format>
"""
```

### Prompting Best Practices

- Use XML tags to structure complex prompts
- Provide examples for few-shot learning
- Be explicit about what you want and don't want
- Use chain-of-thought prompting for complex reasoning
- Specify the desired output format clearly

## Error Handling

### Retry Logic

```python
from anthropic import RateLimitError, APIError
import time

def call_with_retry(func, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            delay = base_delay * (2 ** attempt)
            print(f"Rate limited. Retrying in {delay}s...")
            time.sleep(delay)
        except APIError as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(base_delay)
    raise Exception("Max retries exceeded")
```

### Common Error Types

- `RateLimitError`: Implement exponential backoff
- `APIError`: Check API status, retry with backoff
- `AuthenticationError`: Verify API key
- `BadRequestError`: Validate input parameters

## Prompt Caching

### Using Caching

```python
# Enable caching for frequently used context
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": "Large context that should be cached...",
        "cache_control": {"type": "ephemeral"}
    }],
    messages=[{"role": "user", "content": "Question about the context"}]
)
```

### Caching Best Practices

- Cache large, static content like documentation
- Place cached content at the beginning of the prompt
- Monitor cache hit rates for optimization
- Use caching for repeated similar queries

## Message Batches API

### Batch Processing

```python
# Create a batch for non-time-sensitive requests
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": "request-1",
            "params": {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": "Question 1"}]
            }
        },
        {
            "custom_id": "request-2",
            "params": {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": "Question 2"}]
            }
        }
    ]
)
```

## Cost Optimization

- Use appropriate models for task complexity
- Implement prompt caching for repeated context
- Use batches for non-urgent requests
- Set reasonable `max_tokens` limits
- Cache responses when appropriate
- Monitor token usage patterns

## Security Best Practices

- Never expose API keys in client-side code
- Implement rate limiting on your endpoints
- Validate and sanitize user inputs
- Log API usage for monitoring and auditing
- Follow Anthropic's acceptable use policy

## Dependencies

- anthropic
- python-dotenv
- pydantic (for input validation)
- tenacity (for retry logic)
