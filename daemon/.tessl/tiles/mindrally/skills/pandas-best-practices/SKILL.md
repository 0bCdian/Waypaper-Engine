---
name: pandas-best-practices
description: Best practices for Pandas data manipulation, analysis, and DataFrame operations in Python
---

# Pandas Best Practices

Expert guidelines for Pandas development, focusing on data manipulation, analysis, and efficient DataFrame operations.

## Code Style and Structure

- Write concise, technical responses with accurate Python examples
- Prioritize reproducibility in data analysis workflows
- Use functional programming; avoid unnecessary classes
- Prefer vectorized operations over explicit loops
- Use descriptive variable names reflecting data content
- Follow PEP 8 style guidelines

## DataFrame Creation and I/O

- Use `pd.read_csv()`, `pd.read_excel()`, `pd.read_json()` with appropriate parameters
- Specify `dtype` parameter to ensure correct data types on load
- Use `parse_dates` for automatic datetime parsing
- Set `index_col` when the data has a natural index column
- Use `chunksize` for reading large files incrementally

## Data Selection

- Use `.loc[]` for label-based indexing
- Use `.iloc[]` for integer position-based indexing
- Avoid chained indexing (e.g., `df['col'][0]`) - use `.loc` or `.iloc` instead
- Use boolean indexing for conditional selection: `df[df['col'] > value]`
- Use `.query()` method for complex filtering conditions

## Method Chaining

- Prefer method chaining for data transformations when possible
- Use `.pipe()` for applying custom functions in a chain
- Chain operations like `.assign()`, `.query()`, `.groupby()`, `.agg()`
- Keep chains readable by breaking across multiple lines

## Data Cleaning and Validation

### Missing Data

- Check for missing data with `.isna()` and `.info()`
- Handle missing data appropriately: `.fillna()`, `.dropna()`, or imputation
- Use `pd.NA` for nullable integer and boolean types
- Document decisions about missing data handling

### Data Quality Checks

- Implement data quality checks at the beginning of analysis
- Validate data types with `.dtypes` and convert as needed
- Check for duplicates with `.duplicated()` and handle appropriately
- Use `.describe()` for quick statistical overview

### Type Conversion

- Use `.astype()` for explicit type conversion
- Use `pd.to_datetime()` for date parsing
- Use `pd.to_numeric()` with `errors='coerce'` for safe numeric conversion
- Utilize categorical data types for low-cardinality string columns

## Grouping and Aggregation

### GroupBy Operations

- Use `.groupby()` for efficient aggregation operations
- Specify aggregation functions with `.agg()` for multiple operations
- Use named aggregation for clearer output column names
- Consider `.transform()` for broadcasting results back to original shape

### Pivot Tables and Reshaping

- Use `.pivot_table()` for multi-dimensional aggregation
- Use `.melt()` to convert wide to long format
- Use `.pivot()` to convert long to wide format
- Use `.stack()` and `.unstack()` for hierarchical index manipulation

## Performance Optimization

### Memory Efficiency

- Use categorical data types for low-cardinality strings
- Downcast numeric types when appropriate
- Use `pd.eval()` and `.eval()` for large expression evaluation

### Computation Speed

- Use vectorized operations instead of `.apply()` with row-wise functions
- Prefer built-in aggregation functions over custom ones
- Use `.values` or `.to_numpy()` for NumPy operations when faster

### Avoiding Common Pitfalls

- Avoid iterating with `.iterrows()` - use vectorized operations
- Don't modify DataFrames while iterating
- Be aware of SettingWithCopyWarning - use `.copy()` when needed
- Avoid growing DataFrames row by row - collect in list and create once

## Time Series Operations

- Use `DatetimeIndex` for time series data
- Leverage `.resample()` for time-based aggregation
- Use `.shift()` and `.diff()` for lag operations
- Use `.rolling()` and `.expanding()` for window calculations

## Merging and Joining

- Use `.merge()` for SQL-style joins
- Specify `how` parameter: 'inner', 'outer', 'left', 'right'
- Use `validate` parameter to check join cardinality
- Use `.concat()` for stacking DataFrames

## Key Conventions

- Import as `import pandas as pd`
- Use `snake_case` for column names when possible
- Document data sources and transformations
- Keep notebooks reproducible with clear cell execution order
