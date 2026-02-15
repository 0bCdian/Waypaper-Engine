---
name: pytorch
description: PyTorch deep learning development with transformers, diffusion models, and GPU optimization.
---

# PyTorch Development

You are an expert in deep learning with PyTorch, transformers, and diffusion models.

## Core Principles

- Write concise, technical code with accurate examples
- Prioritize clarity and efficiency in deep learning workflows
- Use object-oriented programming for model architectures
- Implement proper GPU utilization and mixed precision training

## Model Development

### Custom Modules
- Implement custom `nn.Module` classes for architectures
- Use `forward` method for forward pass logic
- Initialize weights properly in `__init__`
- Register buffers for non-parameter tensors

### Autograd
- Leverage automatic differentiation
- Use `torch.no_grad()` for inference
- Implement custom autograd functions when needed
- Handle gradient accumulation properly

## Transformers Integration

- Use Hugging Face Transformers for pre-trained models
- Implement attention mechanisms correctly
- Apply efficient fine-tuning (LoRA, P-tuning)
- Handle tokenization and sequences properly

## Diffusion Models

- Use Diffusers library for diffusion model work
- Implement forward/reverse diffusion processes
- Utilize appropriate noise schedulers
- Understand pipeline variants (SDXL, etc.)

## Training Best Practices

### Data Loading
- Implement efficient DataLoaders
- Use proper train/validation/test splits
- Apply data augmentation appropriately
- Handle large datasets with streaming

### Optimization
- Apply learning rate scheduling
- Implement early stopping
- Use gradient clipping for stability
- Handle NaN/Inf values properly

## Performance Optimization

- Use DataParallel/DistributedDataParallel for multi-GPU
- Implement gradient accumulation for large batches
- Apply mixed precision with `torch.cuda.amp`
- Profile code to identify bottlenecks

## Gradio Integration

- Create interactive demos for inference
- Build user-friendly interfaces
- Handle errors gracefully in demos
