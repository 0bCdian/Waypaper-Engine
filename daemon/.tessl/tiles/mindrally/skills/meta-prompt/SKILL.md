---
name: meta-prompt
description: Meta-prompting framework for critiquing responses, analyzing solution trajectories, and evaluating AI-generated content quality
---

# Meta-Prompt

A collection of meta-prompting techniques for evaluating and analyzing AI responses and solution paths.

## Response Quality Evaluator

A framework for critiquing and reflecting on the quality of responses, providing a score and indicating whether the response has fully solved the question or task.

### Evaluation Fields

**Reflections**: The critique and reflections on the sufficiency, superfluency, and general quality of the response.

**Score**: Score from 0-10 on the quality of the candidate response.

**Found_solution**: Whether the response has fully solved the question or task.

### Evaluation Criteria

When evaluating responses, consider the following:

1. **Accuracy**: Does the response correctly address the question or task?
2. **Completeness**: Does it cover all aspects of the question or task?
3. **Clarity**: Is the response clear and easy to understand?
4. **Conciseness**: Is the response appropriately concise without sacrificing important details?
5. **Relevance**: Does the response stay focused on the question or task at hand?

Provide thoughtful reflections on these aspects and any other relevant factors. Use the score to indicate the overall quality, and set found_solution to true only if the response fully addresses the question or completes the task.

### Example Usage

```
reflections: "The response was clear and concise, addressing the main question effectively. However, it could have provided more context on edge cases."
score: 8
found_solution: true
```

## Question-Answering Trajectory Analyzer

Guidelines for analyzing solution paths to question-answering tasks.

### Trajectory Components

**Observations**: Environmental information about the current situation that provides context for decision-making.

**Thoughts**: Reasoning about the current situation, analyzing what has been observed and planning next steps.

**Actions**: The steps taken to progress toward solving the task.

### Action Types

**Search[entity]**: Searches for the exact entity and returns relevant information if the entity exists. If not, returns suggestions for similar entities.

**Lookup[keyword]**: Returns the next relevant passage that contains the keyword. Used for finding specific information within retrieved content.

**Finish[answer]**: Returns the answer and finishes the task. Used when sufficient information has been gathered to provide a definitive response.

### Analysis Guidelines

When analyzing a trajectory:

1. Evaluate whether each observation provides useful information
2. Assess if thoughts demonstrate logical reasoning
3. Determine if actions are appropriate given the current state
4. Score the trajectory correctness from 1-10
5. Evaluate reasoning validity even in incomplete trajectories
6. Do not generate additional steps; only analyze what is provided

## Prompt Engineering Patterns

### Chain of Thought

Guide the model through step-by-step reasoning:

```
Let's approach this step by step:
1. First, identify the key components
2. Then, analyze each component
3. Finally, synthesize the findings
```

### Few-Shot Learning

Provide examples to establish the pattern:

```
Example 1: [input] -> [output]
Example 2: [input] -> [output]
Now apply this pattern to: [new input]
```

### Self-Consistency

Generate multiple reasoning paths and select the most consistent answer.

### Reflection Prompts

Encourage self-critique:

```
Review your response and identify:
- Any potential errors or oversights
- Areas that could be explained more clearly
- Missing information that would strengthen the answer
```

## Quality Metrics

### Response Scoring Rubric

- **10**: Perfect response, fully addresses all aspects with exceptional clarity
- **8-9**: Excellent response with minor room for improvement
- **6-7**: Good response that addresses the main points but lacks depth
- **4-5**: Adequate response with significant gaps or unclear explanations
- **2-3**: Poor response that misses key aspects or contains errors
- **0-1**: Response fails to address the question or is completely incorrect

### Trajectory Scoring

- **10**: Optimal path with efficient, logical steps
- **7-9**: Good path with minor inefficiencies
- **4-6**: Acceptable path but with unnecessary steps or missed opportunities
- **1-3**: Poor path with fundamental reasoning errors
