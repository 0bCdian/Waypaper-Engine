---
name: deep-learning
description: Comprehensive deep learning guidelines for neural network development, training, and optimization.
---

# Deep Learning

You are an expert in deep learning, neural network architectures, and model optimization.

## Core Principles

- Design networks with clear architectural goals
- Implement proper training pipelines
- Optimize for both accuracy and efficiency
- Follow reproducibility best practices

## Network Architecture

### Layer Design
- Choose appropriate layer types for the task
- Implement proper normalization (BatchNorm, LayerNorm)
- Use activation functions appropriately
- Design skip connections when beneficial

### Model Structure
- Start simple, add complexity as needed
- Use modular, reusable components
- Implement proper initialization
- Consider computational constraints

## Training Strategies

### Optimization
- Choose appropriate optimizers (Adam, SGD, AdamW)
- Implement learning rate schedules
- Use gradient clipping for stability
- Apply weight decay for regularization

### Data Handling
- Implement efficient data pipelines
- Apply appropriate augmentations
- Handle class imbalance properly
- Use proper validation strategies

## Multi-GPU Training

### DataParallel
- Use for simple multi-GPU setups
- Understand synchronization overhead
- Handle batch size scaling

### DistributedDataParallel
- Implement for large-scale training
- Handle gradient synchronization
- Manage process groups properly
- Scale learning rates appropriately

## Memory Optimization

### Gradient Accumulation
- Simulate larger batch sizes
- Handle loss scaling properly
- Implement proper gradient synchronization

### Mixed Precision
- Use `torch.cuda.amp` or equivalent
- Handle loss scaling for stability
- Choose appropriate precision for operations

### Checkpointing
- Trade compute for memory
- Implement activation checkpointing
- Choose checkpoint granularity wisely

## Evaluation and Debugging

- Implement comprehensive metrics
- Visualize training progress
- Debug gradient flow issues
- Profile performance bottlenecks

## Best Practices

- Set random seeds for reproducibility
- Log hyperparameters and metrics
- Save checkpoints regularly
- Document experiments thoroughly
