---
name: matplotlib-best-practices
description: Best practices for Matplotlib data visualization, plotting, and creating publication-quality figures in Python
---

# Matplotlib Best Practices

Expert guidelines for Matplotlib development, focusing on data visualization, plotting, and creating publication-quality figures.

## Code Style and Structure

- Write concise, technical Python code with accurate Matplotlib examples
- Create informative and visually appealing plots with proper labels, titles, and legends
- Use the object-oriented API for complex figures, pyplot for quick plots
- Follow PEP 8 style guidelines
- Consider color-blindness accessibility in all visualizations

## API Approaches

### Object-Oriented Interface (Recommended)

- Use `fig, ax = plt.subplots()` for explicit control
- Preferred for complex figures and production code
- Methods are called on axes objects: `ax.plot()`, `ax.set_xlabel()`
- Enables multiple subplots and fine-grained customization

### Pyplot Interface

- Use `plt.plot()`, `plt.xlabel()` for quick, interactive plots
- Suitable for Jupyter notebooks and exploration
- Use `%matplotlib inline` in Jupyter notebooks

## Creating Effective Visualizations

### Plot Types and Selection

- Line plots (`ax.plot()`) for continuous data and trends
- Scatter plots (`ax.scatter()`) for relationship between variables
- Bar plots (`ax.bar()`, `ax.barh()`) for categorical comparisons
- Histograms (`ax.hist()`) for distributions
- Box plots (`ax.boxplot()`) for statistical summaries
- Heatmaps (`ax.imshow()`, `ax.pcolormesh()`) for 2D data

### Labels and Annotations

- Always include axis labels with units
- Use descriptive titles that convey the message
- Add legends when multiple series are present
- Use annotations (`ax.annotate()`) to highlight key points
- Include data source attribution when appropriate

### Color and Style

- Use colorblind-friendly palettes (e.g., 'viridis', 'plasma', 'cividis')
- Avoid red-green combinations for accessibility
- Use consistent colors for the same categories across figures
- Use appropriate colormaps for data type:
  - Sequential: 'viridis', 'plasma' for continuous data
  - Diverging: 'RdBu', 'coolwarm' for data with meaningful center
  - Qualitative: 'Set1', 'tab10' for categorical data

## Figure Layout and Composition

### Subplots

- Use `plt.subplots(nrows, ncols)` for grid layouts
- Use `gridspec` for complex, non-uniform layouts
- Share axes with `sharex=True`, `sharey=True` for comparison
- Use `constrained_layout=True` or `tight_layout()` to prevent overlap

### Figure Size and Resolution

- Set figure size explicitly: `figsize=(width, height)` in inches
- Use appropriate DPI for intended output (72 screen, 300+ print)
- Standard sizes: (10, 6) for presentations, (8, 6) for papers

## Customization

### Style Sheets

- Use built-in styles: `plt.style.use('seaborn-v0_8')`, `'ggplot'`
- Create custom style files for consistent branding
- Combine styles: `plt.style.use(['seaborn-v0_8', 'custom.mplstyle'])`

### Text and Fonts

- Use LaTeX for mathematical notation: `r'$\alpha = \frac{1}{2}$'`
- Set font family for consistency
- Adjust font sizes for readability at intended display size

## Saving and Exporting

### File Formats

- Use vector formats (PDF, SVG, EPS) for publications
- Use PNG for web and presentations with transparency
- Use JPEG only for photographs (lossy compression)

### Export Settings

- Use `bbox_inches='tight'` to remove excess whitespace
- Set `facecolor` for background color
- Specify `dpi` appropriate for use case
- Use `transparent=True` for overlays

## Performance Optimization

- Use `rasterized=True` for scatter plots with many points
- Consider downsampling data for visualization
- Close figures with `plt.close()` after saving
- Use `plt.close('all')` in loops creating many figures

## Key Conventions

- Import as `import matplotlib.pyplot as plt`
- Use object-oriented API for production code
- Always label axes and include units
- Test visualizations at intended display size
- Consider accessibility in color choices
