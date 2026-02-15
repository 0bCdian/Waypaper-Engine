---
name: langchain-development
description: Expert guidance for LangChain and LangGraph development with Python, covering chain composition, agents, memory, and RAG implementations.
---

# LangChain Development

You are an expert in LangChain, LangGraph, and building LLM-powered applications with Python.

## Key Principles

- Write concise, technical responses with accurate Python examples
- Use functional, declarative programming; avoid classes where possible
- Prefer iteration and modularization over code duplication
- Use descriptive variable names with auxiliary verbs (e.g., is_active, has_context)
- Follow PEP 8 style guidelines strictly

## Code Organization

### Directory Structure

Organize code into logical modules based on functionality:

```
project/
├── chains/           # LangChain chain definitions
├── agents/           # Agent configurations and tools
├── tools/            # Custom tool implementations
├── memory/           # Memory and state management
├── prompts/          # Prompt templates and management
├── retrievers/       # RAG and retrieval components
├── callbacks/        # Custom callback handlers
├── utils/            # Utility functions
├── tests/            # Test files
└── config/           # Configuration files
```

### Naming Conventions

- Use snake_case for files, functions, and variables
- Use PascalCase for classes
- Prefix private functions with underscore
- Use descriptive names that indicate purpose (e.g., `create_retrieval_chain`, `build_agent_executor`)

## LangChain Expression Language (LCEL)

### Chain Composition

- Use LCEL for composing chains with the pipe operator (`|`)
- Prefer `RunnableSequence` and `RunnableParallel` for complex workflows
- Implement proper error handling with `RunnableLambda`

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough

chain = (
    RunnableParallel(
        context=retriever,
        question=RunnablePassthrough()
    )
    | prompt
    | llm
    | output_parser
)
```

### Best Practices

- Always use `invoke()` for single inputs, `batch()` for multiple inputs
- Use `stream()` for real-time token streaming
- Implement `with_config()` for runtime configuration
- Use `bind()` to attach tools or functions to runnables

## Agents and Tools

### Tool Development

- Define tools using the `@tool` decorator with clear docstrings
- Include type hints for all tool parameters
- Implement proper input validation
- Return structured outputs when possible

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="Search query string")

@tool(args_schema=SearchInput)
def search_database(query: str) -> str:
    """Search the database for relevant information."""
    # Implementation
    return results
```

### Agent Configuration

- Use `create_react_agent` or `create_tool_calling_agent` based on model capabilities
- Implement proper agent executors with max iterations
- Add callbacks for monitoring and debugging
- Use structured chat agents for complex tool interactions

## Memory and State Management

### Conversation Memory

- Use `ConversationBufferMemory` for short conversations
- Implement `ConversationSummaryMemory` for long conversations
- Consider `ConversationBufferWindowMemory` for fixed-length history
- Use persistent storage backends for production (Redis, PostgreSQL)

### LangGraph State

- Define explicit state schemas using TypedDict
- Implement proper state reducers for complex state updates
- Use checkpointing for resumable workflows
- Handle state persistence across sessions

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]
    context: str
    next_step: str

graph = StateGraph(AgentState)
```

## RAG (Retrieval-Augmented Generation)

### Document Processing

- Use appropriate text splitters (RecursiveCharacterTextSplitter, MarkdownTextSplitter)
- Implement proper chunk sizing with overlap
- Preserve metadata during splitting
- Use document loaders appropriate for file types

### Vector Stores

- Choose vector stores based on scale requirements
- Implement proper embedding caching
- Use hybrid search when available (dense + sparse)
- Configure appropriate similarity metrics

### Retrieval Strategies

- Implement multi-query retrieval for complex questions
- Use contextual compression to reduce noise
- Consider parent document retrieval for better context
- Implement re-ranking for improved relevance

## LangSmith Integration

### Monitoring

- Enable tracing with `LANGCHAIN_TRACING_V2=true`
- Add run names for easy identification
- Implement custom metadata for filtering
- Use tags for categorization

### Debugging

- Review traces for performance bottlenecks
- Analyze token usage patterns
- Monitor latency across chain components
- Set up alerts for error rates

## Error Handling

- Implement retry logic with exponential backoff
- Handle rate limits from LLM providers gracefully
- Use fallback chains for critical paths
- Log errors with sufficient context

```python
from langchain_core.runnables import RunnableWithFallbacks

chain_with_fallback = primary_chain.with_fallbacks(
    [fallback_chain],
    exceptions_to_handle=(RateLimitError, TimeoutError)
)
```

## Performance Optimization

- Use async methods (`ainvoke`, `abatch`) for I/O-bound operations
- Implement caching for expensive operations
- Batch requests when possible
- Use streaming for better user experience

## Testing

- Write unit tests for individual chain components
- Implement integration tests for full chains
- Use mocking for LLM calls in unit tests
- Test edge cases and error conditions

## Dependencies

- langchain
- langchain-core
- langchain-community
- langgraph
- langsmith
- python-dotenv
- pydantic
