# Claude Code Skills Collection

**240+ Claude Code skills converted from Cursor rules. Supercharge your AI coding with expert guidelines for React, Python, TypeScript, and everything in between.**

A comprehensive collection of skills for [Claude Code](https://claude.ai/code), Anthropic's official CLI for Claude.

## Origin

These skills were converted from **Cursor Rules** (`.cursorrules` files) to the Claude Code skills format (`SKILL.md`). The original Cursor rules provided coding guidelines and best practices that Cursor AI would follow when generating code.

Each skill has been reformatted to work with Claude Code's skill system, which uses YAML frontmatter for metadata and markdown for the actual guidelines.

## What Are Skills?

Skills are reusable instruction sets that enhance Claude Code's capabilities for specific technologies, frameworks, or development practices. When activated, they provide Claude with expert-level context about:

- Coding conventions and best practices
- Framework-specific patterns
- Project structure guidelines
- Error handling approaches
- Performance optimization techniques

## Skill Format

Each skill follows this structure:

```markdown
---
name: skill-name
description: Brief description of the skill
---

# Skill Title

Guidelines and instructions...
```

## Installation

### Option 1: Copy Individual Skills

Copy desired skill folders to your project's `.claude/skills/` directory:

```bash
cp -r skills/react /path/to/your/project/.claude/skills/
```

### Option 2: Global Installation

Copy skills to your global Claude Code configuration:

```bash
cp -r skills/* ~/.claude/skills/
```

### Option 3: Clone Entire Repository

```bash
git clone https://github.com/YOUR_USERNAME/skills.git ~/.claude/skills
```

## Available Skills

### Frontend Frameworks
| Skill | Description |
|-------|-------------|
| `react` | React development with hooks, performance optimization |
| `nextjs-react-typescript` | Next.js with React and TypeScript |
| `vue-typescript` | Vue.js with TypeScript |
| `angular` | Angular framework development |
| `svelte` | Svelte framework |
| `sveltekit` | SvelteKit full-stack framework |
| `remix` | Remix framework |
| `astro` | Astro static site generator |
| `nuxtjs-vue-typescript` | Nuxt.js with Vue and TypeScript |

### Mobile Development
| Skill | Description |
|-------|-------------|
| `react-native-cursor-rules` | React Native development |
| `expo-react-native-typescript` | Expo with React Native and TypeScript |
| `flutter` | Flutter cross-platform development |
| `swift` | Swift language development |
| `swiftui-development` | SwiftUI interface development |
| `android-development` | Android native development |
| `kotlin-development` | Kotlin development |
| `ionic` | Ionic hybrid mobile apps |

### Backend & APIs
| Skill | Description |
|-------|-------------|
| `nodejs-development` | Node.js backend development |
| `express-typescript` | Express.js with TypeScript |
| `fastapi-python` | FastAPI Python framework |
| `django-python` | Django web framework |
| `flask-python` | Flask Python framework |
| `ruby-rails` | Ruby on Rails |
| `laravel` | Laravel PHP framework |
| `spring-boot` | Spring Boot Java framework |
| `go-backend-microservices` | Go microservices |
| `nestjs-clean-typescript` | NestJS with clean architecture |
| `graphql` | GraphQL API development |
| `grpc-development` | gRPC development |
| `trpc` | tRPC type-safe APIs |

### Languages
| Skill | Description |
|-------|-------------|
| `typescript` | TypeScript best practices |
| `python` | Python development |
| `go` | Go language |
| `rust` | Rust programming |
| `java` | Java development |
| `c-sharp` | C# development |
| `ruby` | Ruby development |
| `php-development` | PHP development |
| `elixir` | Elixir functional programming |
| `julia` | Julia scientific computing |
| `lua` | Lua scripting |
| `cpp` | C++ development |

### Databases & ORMs
| Skill | Description |
|-------|-------------|
| `prisma` | Prisma ORM |
| `drizzle-orm` | Drizzle ORM |
| `sequelize` | Sequelize ORM |
| `typeorm` | TypeORM |
| `mongodb-development` | MongoDB |
| `postgresql-best-practices` | PostgreSQL |
| `mysql-best-practices` | MySQL |
| `redis-best-practices` | Redis |
| `elasticsearch-best-practices` | Elasticsearch |
| `supabase` | Supabase backend |

### DevOps & Infrastructure
| Skill | Description |
|-------|-------------|
| `docker` | Docker containerization |
| `kubernetes` | Kubernetes orchestration |
| `terraform` | Terraform IaC |
| `aws-development` | AWS cloud development |
| `gcp-development` | Google Cloud Platform |
| `azure` | Microsoft Azure |
| `ci-cd-best-practices` | CI/CD pipelines |
| `github-workflow` | GitHub Actions workflows |
| `gitlab-workflow` | GitLab CI/CD |
| `serverless` | Serverless architecture |

### Testing
| Skill | Description |
|-------|-------------|
| `testing` | General testing practices |
| `jest` | Jest testing framework |
| `cypress` | Cypress E2E testing |
| `playwright` | Playwright testing |
| `python-testing` | Python testing |
| `rspec` | RSpec for Ruby |

### AI & Machine Learning
| Skill | Description |
|-------|-------------|
| `deep-learning` | Deep learning practices |
| `pytorch` | PyTorch framework |
| `langchain-development` | LangChain LLM development |
| `llamaindex-development` | LlamaIndex development |
| `openai-api-development` | OpenAI API integration |
| `anthropic-claude-development` | Claude API development |
| `transformers-huggingface` | Hugging Face Transformers |
| `machine-learning` | ML best practices |
| `computer-vision-opencv` | OpenCV computer vision |
| `nlp-natural-language-processing` | NLP development |

### Styling & UI
| Skill | Description |
|-------|-------------|
| `tailwindcss` | Tailwind CSS |
| `css` | CSS best practices |
| `sass-best-practices` | Sass/SCSS |
| `styled-components-best-practices` | Styled Components |
| `framer-motion` | Framer Motion animations |
| `three-js` | Three.js 3D graphics |
| `design-systems` | Design system development |
| `ui-design` | UI design principles |
| `ux-design` | UX design principles |

### Build Tools
| Skill | Description |
|-------|-------------|
| `vite` | Vite build tool |
| `webpack-bundler` | Webpack |
| `esbuild-bundler` | esbuild |
| `parcel-bundler` | Parcel |
| `rollup-bundler` | Rollup |
| `turbopack-bundler` | Turbopack |

### Authentication
| Skill | Description |
|-------|-------------|
| `auth0-authentication` | Auth0 |
| `nextauth-authentication` | NextAuth.js |
| `clerk-authentication` | Clerk |
| `oauth-implementation` | OAuth |
| `jwt-security` | JWT security |

### Blockchain & Web3
| Skill | Description |
|-------|-------------|
| `ethereum` | Ethereum development |
| `solidity` | Solidity smart contracts |
| `solana` | Solana development |
| `blockchain` | General blockchain |
| `onchainkit` | OnchainKit |

### State Management
| Skill | Description |
|-------|-------------|
| `zustand-state-management` | Zustand |
| `redux-toolkit` | Redux Toolkit |
| `react-query` | React Query |
| `tanstack-query` | TanStack Query |
| `swr` | SWR data fetching |

### CMS & E-commerce
| Skill | Description |
|-------|-------------|
| `wordpress` | WordPress development |
| `shopify` | Shopify development |
| `woocommerce` | WooCommerce |
| `drupal-development` | Drupal |
| `sanity` | Sanity CMS |
| `ghost` | Ghost CMS |

### Utilities & Best Practices
| Skill | Description |
|-------|-------------|
| `git-workflow` | Git best practices |
| `security-best-practices` | Security guidelines |
| `performance-optimization` | Performance tuning |
| `accessibility-a11y` | Accessibility |
| `seo-best-practices` | SEO optimization |
| `technical-writing` | Technical documentation |
| `logging-best-practices` | Logging practices |
| `observability-guidelines` | Observability |
| `internationalization-i18n` | i18n |
| `localization-l10n` | l10n |

### Complete List (240 Skills)

<details>
<summary>Click to expand full list</summary>

- accessibility-a11y
- alpine-js
- analytics-data-analysis
- android-development
- angular
- angular-development
- anime-js
- anthropic-claude-development
- api-development
- apollo-graphql
- aspnet-core
- astro
- auth0-authentication
- autogen-development
- aws-development
- azure
- backend-development
- bash-scripting
- beautifulsoup-parsing
- bitbucket-workflow
- blazor
- blockchain
- bootstrap
- business-central-development
- c-sharp
- cheerio-parsing
- chrome-extension-development
- ci-cd-best-practices
- clean-architecture
- clerk-authentication
- cloudflare-development
- computer-vision-opencv
- convex
- cpp
- css
- cypress
- data-analysis-jupyter
- data-analyst
- data-jupyter-python
- deep-learning
- deep-learning-python
- deep-learning-pytorch
- deno-typescript
- design-systems
- devops
- django-python
- django-rest-api-development
- docker
- dotnet
- drizzle-orm
- drupal-development
- elasticsearch-best-practices
- electron-development
- elixir
- esbuild-bundler
- ethereum
- expo-react-native-javascript-best-practices
- expo-react-native-typescript
- express-typescript
- fastapi-microservices-serverless
- fastapi-python
- fastify-typescript
- figma-integration
- firebase-development
- flask-python
- flutter
- fpga
- framer-motion
- front-end-developer
- game-development
- gcp-development
- general-best-practices
- ghost
- git-workflow
- github-workflow
- gitlab-workflow
- go
- go-api-development
- go-backend-microservices
- graalvm
- graphql
- graphql-development
- grpc-development
- gsap
- hono-typescript
- html
- htmx
- internationalization-i18n
- ionic
- java
- java-quarkus-development
- java-spring-development
- jax-best-practices
- jest
- julia
- jwt-security
- kafka-development
- koa-typescript
- kotlin-development
- kubernetes
- kysely
- langchain-development
- laravel
- laravel-development
- lerna
- less-best-practices
- llamaindex-development
- llm
- localization-l10n
- logging-best-practices
- lottie
- lua
- machine-learning
- matplotlib-best-practices
- meta-prompt
- micronaut
- microservices
- modern-web-development
- mongodb-development
- monitoring-guidelines
- monorepo
- monorepo-tamagui
- motion
- mqtt-development
- mysql-best-practices
- nestjs-clean-typescript
- netlify-development
- nextauth-authentication
- nextjs-react-redux-typescript-cursor-rules
- nextjs-react-typescript
- nextjs-typescript-tailwindcss-supabase
- nlp-natural-language-processing
- nodejs-development
- numpy-best-practices
- nuxtjs-vue-typescript
- nx
- oauth-implementation
- observability-guidelines
- odoo-development
- onchainkit
- openai-api-development
- optimized-nextjs-typescript
- pandas-best-practices
- parcel-bundler
- performance-optimization
- phoenix
- php-development
- pixi-js
- playwright
- playwright-cursor-rules
- pnpm
- postcss-best-practices
- postgresql-best-practices
- prisma
- prisma-development
- puppeteer-automation
- pwa-development
- python
- python-cybersecurity-tool-development
- python-odoo-cursor-rules
- python-testing
- python-uv
- pytorch
- quarkus
- rabbitmq-development
- react
- react-native-cursor-rules
- react-native-r3f
- react-query
- redis-best-practices
- redux-toolkit
- remix
- responsive-design
- rest-api-django
- robocorp-cursor-rules
- rollup-bundler
- rspec
- ruby
- ruby-rails
- rust
- salesforce-development
- salesforce-dx
- sanity
- sass-best-practices
- scikit-learn-best-practices
- scipy-best-practices
- scrapy-web-scraping
- scss-best-practices
- security-best-practices
- selenium-automation
- seo-best-practices
- sequelize
- serverless
- shopify
- shopify-theme-development-guidelines
- solana
- solidity
- spring-boot
- spring-framework
- sql-best-practices
- storybook
- stripe
- styled-components-best-practices
- supabase
- supabase-development
- svelte
- sveltekit
- swift
- swiftui-development
- swr
- systemverilog
- tailwindcss
- tanstack-query
- tauri-development
- technical-writing
- terraform
- testing
- three-js
- transformers-huggingface
- trpc
- turbopack-bundler
- turborepo
- typeorm
- typescript
- ui-design
- unity
- ux-design
- vercel-development
- viewcomfy-api-rules
- vite
- vue-typescript
- vuejs-typescript-best-practices
- web-development
- web-scraping
- webpack-bundler
- websocket-development
- woocommerce
- wordpress
- zod-schema-validation
- zustand-state-management

</details>

## Usage

Once installed, skills are automatically available in Claude Code. You can reference them in your conversations or they may be automatically applied based on your project context.

## Contributing

Contributions are welcome! To add a new skill:

1. Create a new directory with a descriptive name (kebab-case)
2. Add a `SKILL.md` file with proper frontmatter
3. Follow the existing format and style
4. Submit a pull request

## License

MIT License - Feel free to use, modify, and distribute these skills.

## Credits

- Original Cursor rules from the open-source community
- Converted and curated for Claude Code compatibility
