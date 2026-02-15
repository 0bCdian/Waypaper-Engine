---
name: scikit-learn-best-practices
description: Best practices for scikit-learn machine learning, model development, evaluation, and deployment in Python
---

# Scikit-learn Best Practices

Expert guidelines for scikit-learn development, focusing on machine learning workflows, model development, evaluation, and best practices.

## Code Style and Structure

- Write concise, technical responses with accurate Python examples
- Prioritize reproducibility in machine learning workflows
- Use functional programming for data pipelines
- Use object-oriented programming for custom estimators
- Prefer vectorized operations over explicit loops
- Follow PEP 8 style guidelines

## Machine Learning Workflow

### Data Preparation

- Always split data before any preprocessing: train/validation/test
- Use `train_test_split()` with `random_state` for reproducibility
- Stratify splits for imbalanced classification: `stratify=y`
- Keep test set completely separate until final evaluation

### Feature Engineering

- Scale features appropriately for distance-based algorithms
- Use `StandardScaler` for normally distributed features
- Use `MinMaxScaler` for bounded features
- Use `RobustScaler` for data with outliers
- Encode categorical variables: `OneHotEncoder`, `OrdinalEncoder`, `LabelEncoder`
- Handle missing values: `SimpleImputer`, `KNNImputer`

### Pipelines

- Always use `Pipeline` to chain preprocessing and modeling
- Prevents data leakage by fitting transformers only on training data
- Makes code cleaner and more reproducible
- Enables easy deployment and serialization

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier

pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('classifier', RandomForestClassifier(random_state=42))
])
```

### Column Transformers

- Use `ColumnTransformer` for different preprocessing per feature type
- Combine numeric and categorical preprocessing in single pipeline

## Model Selection and Tuning

### Cross-Validation

- Use cross-validation for reliable performance estimates
- `cross_val_score()` for quick evaluation
- `cross_validate()` for multiple metrics
- Use appropriate CV strategy:
  - `KFold` for regression
  - `StratifiedKFold` for classification
  - `TimeSeriesSplit` for temporal data
  - `GroupKFold` for grouped data

### Hyperparameter Tuning

- Use `GridSearchCV` for exhaustive search
- Use `RandomizedSearchCV` for large parameter spaces
- Always tune on training/validation data, never test data
- Set `n_jobs=-1` for parallel processing

## Model Evaluation

### Classification Metrics

- Use appropriate metrics for your problem:
  - `accuracy_score` for balanced classes
  - `precision_score`, `recall_score`, `f1_score` for imbalanced
  - `roc_auc_score` for ranking ability
- Use `classification_report()` for comprehensive overview
- Examine `confusion_matrix()` for error analysis

### Regression Metrics

- `mean_squared_error` (MSE) for general use
- `mean_absolute_error` (MAE) for interpretability
- `r2_score` for explained variance

### Evaluation Best Practices

- Report confidence intervals, not just point estimates
- Use multiple metrics to understand model behavior
- Compare against meaningful baselines
- Evaluate on held-out test set only once, at the end

## Handling Imbalanced Data

- Use stratified splitting and cross-validation
- Consider class weights: `class_weight='balanced'`
- Use appropriate metrics (F1, AUC-PR, not accuracy)
- Adjust decision threshold based on business needs

## Feature Selection

- Use `SelectKBest` with statistical tests
- Use `RFE` (Recursive Feature Elimination)
- Use model-based selection: `SelectFromModel`
- Examine feature importances from tree-based models

## Model Persistence

- Use `joblib` for saving and loading models
- Save entire pipelines, not just models
- Version control model artifacts
- Document model metadata

## Performance Optimization

- Use `n_jobs=-1` for parallel processing where available
- Consider `warm_start=True` for iterative training
- Use sparse matrices for high-dimensional sparse data
- Consider incremental learning with `partial_fit()` for large data

## Key Conventions

- Import from submodules: `from sklearn.ensemble import RandomForestClassifier`
- Set `random_state` for reproducibility
- Use pipelines to prevent data leakage
- Document model choices and hyperparameters
