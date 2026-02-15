---
name: sanity
description: Sanity CMS development guidelines for schema creation, GROQ queries, TypeScript integration, and project organization
---

# Sanity CMS Development

You are an expert in Sanity CMS, GROQ queries, TypeScript integration, and headless CMS architecture.

## Core Principles

- Design schemas with content modeling best practices
- Write efficient GROQ queries
- Use TypeScript for type safety
- Organize projects for scalability
- Implement proper validation and preview

## Project Structure

```
sanity/
├── schemas/
│   ├── documents/
│   │   ├── post.ts
│   │   └── author.ts
│   ├── objects/
│   │   ├── blockContent.ts
│   │   └── image.ts
│   └── index.ts
├── lib/
│   ├── client.ts
│   └── queries.ts
├── components/
│   └── previews/
└── sanity.config.ts
```

## Schema Definition

### Document Types

```typescript
// schemas/documents/post.ts
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().min(10).max(80),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare({ title, author, media }) {
      return {
        title,
        subtitle: author ? `by ${author}` : '',
        media,
      };
    },
  },
});
```

### Object Types

```typescript
// schemas/objects/blockContent.ts
import { defineType, defineArrayMember } from 'sanity';

export default defineType({
  name: 'blockContent',
  title: 'Block Content',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: 'Quote', value: 'blockquote' },
      ],
      marks: {
        decorators: [
          { title: 'Strong', value: 'strong' },
          { title: 'Emphasis', value: 'em' },
          { title: 'Code', value: 'code' },
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'URL',
            fields: [
              {
                name: 'href',
                type: 'url',
                title: 'URL',
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({
      type: 'image',
      options: { hotspot: true },
    }),
  ],
});
```

## GROQ Queries

### Basic Queries

```typescript
// lib/queries.ts

// Get all posts
export const allPostsQuery = groq`
  *[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    "author": author->name,
    "imageUrl": mainImage.asset->url
  }
`;

// Get single post by slug
export const postBySlugQuery = groq`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    body,
    publishedAt,
    "author": author->{name, image},
    "categories": categories[]->title
  }
`;

// Pagination
export const paginatedPostsQuery = groq`
  *[_type == "post"] | order(publishedAt desc) [$start...$end] {
    _id,
    title,
    slug,
    excerpt
  }
`;
```

### Advanced GROQ

```typescript
// Conditional projections
export const conditionalQuery = groq`
  *[_type == "post"] {
    title,
    "content": select(
      defined(body) => body,
      "No content available"
    )
  }
`;

// Coalesce for fallbacks
export const fallbackQuery = groq`
  *[_type == "post"] {
    "displayTitle": coalesce(seoTitle, title)
  }
`;

// References
export const withReferencesQuery = groq`
  *[_type == "post" && references($authorId)] {
    title,
    publishedAt
  }
`;
```

## Client Setup

```typescript
// lib/client.ts
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: process.env.NODE_ENV === 'production',
});

const builder = imageUrlBuilder(client);

export function urlFor(source: any) {
  return builder.image(source);
}
```

## TypeScript Integration

```typescript
// Generate types from schema
import { Post, Author } from '@/sanity/types';

export async function getPosts(): Promise<Post[]> {
  return client.fetch(allPostsQuery);
}

export async function getPost(slug: string): Promise<Post | null> {
  return client.fetch(postBySlugQuery, { slug });
}
```

## Validation

```typescript
defineField({
  name: 'email',
  type: 'string',
  validation: (Rule) =>
    Rule.required()
      .email()
      .custom((email) => {
        if (email && !email.endsWith('@company.com')) {
          return 'Must be a company email';
        }
        return true;
      }),
});
```

## Custom Components

```typescript
// Custom input component
import { StringInputProps } from 'sanity';

export function CustomStringInput(props: StringInputProps) {
  return (
    <div>
      <label>{props.schemaType.title}</label>
      {props.renderDefault(props)}
      <span>{props.value?.length ?? 0} characters</span>
    </div>
  );
}
```

## Best Practices

- Use references for relationships between documents
- Implement proper validation rules
- Create meaningful preview configurations
- Use portable text for rich content
- Optimize images with Sanity's image pipeline
- Set up proper CORS and API permissions
