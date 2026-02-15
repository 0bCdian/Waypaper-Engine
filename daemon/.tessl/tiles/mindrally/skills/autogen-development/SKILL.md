---
name: autogen-development
description: Expert guidance for Microsoft AutoGen multi-agent framework development including agent creation, conversations, tool integration, and orchestration patterns.
---

# AutoGen Multi-Agent Development

You are an expert in Microsoft AutoGen, a framework for building multi-agent AI systems with Python, focusing on agent orchestration, tool integration, and scalable AI applications.

## Key Principles

- Write concise, technical responses with accurate Python examples
- Use async/await patterns for agent communication
- Implement proper error handling and logging
- Follow event-driven architecture patterns
- Use type hints for all function signatures

## Setup and Installation

### Environment Setup

```python
# Install AutoGen
# pip install autogen-agentchat autogen-ext

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_ext.models.openai import OpenAIChatCompletionClient
```

### Model Configuration

```python
import os

# Configure the model client
model_client = OpenAIChatCompletionClient(
    model="gpt-4o",
    api_key=os.environ.get("OPENAI_API_KEY")
)
```

## Core Concepts

### Agent Types

AutoGen provides several agent types:

- **AssistantAgent**: AI-powered agent for conversations and task completion
- **UserProxyAgent**: Represents human users, can execute code
- **GroupChat**: Orchestrates multi-agent conversations
- **ConversableAgent**: Base class for custom agents

## Creating Agents

### Basic Assistant Agent

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient

model_client = OpenAIChatCompletionClient(model="gpt-4o")

assistant = AssistantAgent(
    name="assistant",
    model_client=model_client,
    system_message="""You are a helpful AI assistant.
    Provide clear, concise responses.
    Ask clarifying questions when needed."""
)
```

### Agent with Tools

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_core.tools import FunctionTool

def search_database(query: str) -> str:
    """Search the database for information.

    Args:
        query: The search query string

    Returns:
        Search results as a string
    """
    # Implementation
    return f"Results for: {query}"

def calculate(expression: str) -> str:
    """Evaluate a mathematical expression.

    Args:
        expression: Mathematical expression to evaluate

    Returns:
        The result of the calculation
    """
    try:
        result = eval(expression)
        return str(result)
    except Exception as e:
        return f"Error: {str(e)}"

# Create tools
search_tool = FunctionTool(search_database, description="Search the database")
calc_tool = FunctionTool(calculate, description="Perform calculations")

# Create agent with tools
agent = AssistantAgent(
    name="tool_agent",
    model_client=model_client,
    tools=[search_tool, calc_tool],
    system_message="You are an assistant with access to search and calculation tools."
)
```

## Multi-Agent Conversations

### Two-Agent Chat

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import TextMentionTermination
from autogen_agentchat.teams import RoundRobinGroupChat

# Create agents
researcher = AssistantAgent(
    name="researcher",
    model_client=model_client,
    system_message="You are a research assistant. Gather and analyze information."
)

writer = AssistantAgent(
    name="writer",
    model_client=model_client,
    system_message="You are a technical writer. Create clear documentation."
)

# Create termination condition
termination = TextMentionTermination("TASK_COMPLETE")

# Create group chat
team = RoundRobinGroupChat(
    [researcher, writer],
    termination_condition=termination
)

# Run the conversation
async def run_team():
    result = await team.run(task="Research and document Python best practices")
    return result
```

### Group Chat with Multiple Agents

```python
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.conditions import MaxMessageTermination

# Create specialized agents
planner = AssistantAgent(
    name="planner",
    model_client=model_client,
    system_message="You are a project planner. Break down tasks and create plans."
)

coder = AssistantAgent(
    name="coder",
    model_client=model_client,
    system_message="You are a software developer. Write clean, efficient code."
)

reviewer = AssistantAgent(
    name="reviewer",
    model_client=model_client,
    system_message="You are a code reviewer. Review code for quality and best practices."
)

# Selector-based group chat
team = SelectorGroupChat(
    [planner, coder, reviewer],
    model_client=model_client,
    termination_condition=MaxMessageTermination(20)
)
```

## Code Execution

### Setting Up Code Execution

```python
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from autogen_agentchat.agents import AssistantAgent

# Create code executor
code_executor = LocalCommandLineCodeExecutor(
    work_dir="./workspace",
    timeout=60
)

# Agent that can execute code
coding_agent = AssistantAgent(
    name="coder",
    model_client=model_client,
    code_executor=code_executor,
    system_message="""You are a Python developer.
    Write code to solve problems.
    Test your code before providing final answers."""
)
```

### Docker-Based Execution

```python
from autogen_ext.code_executors.docker import DockerCommandLineCodeExecutor

# Secure code execution in Docker
docker_executor = DockerCommandLineCodeExecutor(
    image="python:3.11-slim",
    timeout=120,
    work_dir="./workspace"
)
```

## Conversation Patterns

### Sequential Workflow

```python
from autogen_agentchat.teams import Swarm
from autogen_agentchat.agents import AssistantAgent

# Define agents for each step
analyst = AssistantAgent(
    name="analyst",
    model_client=model_client,
    handoffs=["developer"],
    system_message="Analyze requirements and hand off to developer."
)

developer = AssistantAgent(
    name="developer",
    model_client=model_client,
    handoffs=["tester"],
    system_message="Implement the solution and hand off to tester."
)

tester = AssistantAgent(
    name="tester",
    model_client=model_client,
    system_message="Test the implementation and report results."
)

# Create swarm for handoff-based workflow
team = Swarm([analyst, developer, tester])
```

### Hierarchical Structure

```python
# Manager agent that coordinates others
manager = AssistantAgent(
    name="manager",
    model_client=model_client,
    system_message="""You are a project manager.
    Coordinate between team members.
    Delegate tasks appropriately.
    Synthesize results into final deliverables."""
)

# Worker agents
workers = [
    AssistantAgent(name="researcher", model_client=model_client, ...),
    AssistantAgent(name="analyst", model_client=model_client, ...),
    AssistantAgent(name="writer", model_client=model_client, ...)
]
```

## Memory and State

### Conversation Memory

```python
from autogen_agentchat.messages import TextMessage

# Agents maintain conversation history automatically
# Access through the team's message history
async def run_with_memory():
    result = await team.run(task="Initial task")

    # Continue with context
    result = await team.run(task="Follow-up question")

    # Access message history
    for message in result.messages:
        print(f"{message.source}: {message.content}")
```

## Event-Driven Architecture

### Custom Event Handling

```python
from autogen_core import Event

# Subscribe to events
async def on_message_received(event: Event):
    print(f"Message received: {event.data}")

# Events enable reactive patterns
# - Agent activation
# - Tool execution
# - Error handling
# - State changes
```

## Error Handling

### Robust Agent Design

```python
from autogen_agentchat.agents import AssistantAgent
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def safe_run_team(team, task: str, max_retries: int = 3):
    """Run team with error handling and retries."""
    for attempt in range(max_retries):
        try:
            result = await team.run(task=task)
            return result
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise
    return None
```

## Best Practices

### Agent Design

- Give agents clear, focused responsibilities
- Use descriptive system messages
- Implement proper tool descriptions
- Set appropriate termination conditions
- Use handoffs for complex workflows

### Performance

- Use async patterns for concurrent operations
- Implement caching for repeated queries
- Set reasonable timeouts
- Monitor token usage
- Use appropriate model sizes for each agent

### Security

- Never execute untrusted code directly
- Use Docker for code execution
- Validate tool inputs
- Implement rate limiting
- Log all agent actions

### Testing

- Unit test individual agents
- Integration test multi-agent workflows
- Test termination conditions
- Validate tool execution
- Monitor conversation quality

## Dependencies

- autogen-agentchat
- autogen-core
- autogen-ext
- openai (or other LLM providers)
- python-dotenv
- docker (for secure code execution)

## Common Patterns

### Research and Writing

```python
# Pattern: Research -> Analyze -> Write -> Review
agents = [
    AssistantAgent(name="researcher", ...),
    AssistantAgent(name="analyst", ...),
    AssistantAgent(name="writer", ...),
    AssistantAgent(name="reviewer", ...)
]
```

### Code Generation

```python
# Pattern: Plan -> Code -> Test -> Review
agents = [
    AssistantAgent(name="architect", ...),
    AssistantAgent(name="developer", code_executor=executor, ...),
    AssistantAgent(name="tester", ...),
    AssistantAgent(name="reviewer", ...)
]
```

### Data Analysis

```python
# Pattern: Extract -> Transform -> Analyze -> Report
agents = [
    AssistantAgent(name="data_engineer", ...),
    AssistantAgent(name="analyst", tools=[calc_tools], ...),
    AssistantAgent(name="reporter", ...)
]
```
