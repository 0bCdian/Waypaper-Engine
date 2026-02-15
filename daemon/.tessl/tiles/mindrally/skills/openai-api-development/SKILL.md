---
name: openai-api-development
description: Expert guidance for OpenAI API development including GPT models, Assistants API, function calling, embeddings, and best practices for production applications.
---

# OpenAI API Development

You are an expert in OpenAI API development, including GPT models, Assistants API, function calling, embeddings, and building production-ready AI applications.

## Key Principles

- Write concise, technical responses with accurate Python examples
- Use type hints for all function signatures
- Implement proper error handling and retry logic
- Never hardcode API keys; use environment variables
- Follow OpenAI's usage policies and rate limit guidelines

## Setup and Configuration

### Environment Setup

```python
import os
from openai import OpenAI

# Always use environment variables for API keys
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
```

### Best Practices

- Store API keys in `.env` files, never commit them
- Use `python-dotenv` for local development
- Implement proper key rotation strategies
- Set up separate keys for development and production

## Chat Completions API

### Basic Usage

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    temperature=0.7,
    max_tokens=1000
)

message = response.choices[0].message.content
```

### Streaming Responses

```python
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Model Selection

- Use `gpt-4o` for complex reasoning and multimodal tasks
- Use `gpt-4o-mini` for faster, cost-effective responses
- Use `o1` models for advanced reasoning tasks
- Consider `gpt-3.5-turbo` for simple tasks requiring speed

## Function Calling

### Defining Functions

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and state, e.g., San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)
```

### Handling Tool Calls

```python
import json

def process_tool_calls(response, messages):
    tool_calls = response.choices[0].message.tool_calls

    if tool_calls:
        messages.append(response.choices[0].message)

        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)

            # Execute the function
            result = execute_function(function_name, function_args)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

        # Get final response
        return client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools
        )

    return response
```

## Assistants API

### Creating an Assistant

```python
assistant = client.beta.assistants.create(
    name="Data Analyst",
    instructions="You are a data analyst. Analyze data and provide insights.",
    tools=[
        {"type": "code_interpreter"},
        {"type": "file_search"}
    ],
    model="gpt-4o"
)
```

### Managing Threads

```python
# Create a thread
thread = client.beta.threads.create()

# Add a message
message = client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="Analyze this data..."
)

# Run the assistant
run = client.beta.threads.runs.create_and_poll(
    thread_id=thread.id,
    assistant_id=assistant.id
)

# Get messages
if run.status == "completed":
    messages = client.beta.threads.messages.list(thread_id=thread.id)
```

## Embeddings

### Generating Embeddings

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="Your text to embed",
    encoding_format="float"
)

embedding = response.data[0].embedding
```

### Best Practices for Embeddings

- Use `text-embedding-3-small` for cost-effective solutions
- Use `text-embedding-3-large` for maximum accuracy
- Batch requests for efficiency (up to 2048 inputs)
- Cache embeddings to avoid redundant API calls
- Use appropriate dimensions parameter for storage optimization

## Vision and Multimodal

### Image Analysis

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/image.jpg",
                        "detail": "high"
                    }
                }
            ]
        }
    ]
)
```

## Error Handling

### Retry Logic

```python
from openai import RateLimitError, APIError
import time

def call_with_retry(func, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            delay = base_delay * (2 ** attempt)
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
- `InvalidRequestError`: Validate input parameters

## Cost Optimization

- Use appropriate models for task complexity
- Implement token counting before requests
- Use streaming for long responses
- Cache responses when appropriate
- Set reasonable `max_tokens` limits
- Use batch API for non-time-sensitive requests

## Security Best Practices

- Never expose API keys in client-side code
- Implement rate limiting on your endpoints
- Validate and sanitize user inputs
- Use content moderation for user-generated content
- Log API usage for monitoring and auditing

## Dependencies

- openai
- python-dotenv
- tiktoken (for token counting)
- pydantic (for input validation)
- tenacity (for retry logic)
