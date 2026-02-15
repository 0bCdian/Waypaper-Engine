---
name: apollo-graphql
description: Guidelines for developing GraphQL APIs and React applications using Apollo Client for state management, data fetching, and caching
---

# Apollo GraphQL Best Practices

You are an expert in Apollo Client, GraphQL, TypeScript, and React development. Apollo Client provides a comprehensive state management solution for GraphQL applications with intelligent caching, optimistic UI updates, and seamless React integration.

## Core Principles

- Use Apollo Client for state management and data fetching
- Implement query components for data fetching
- Utilize mutations for data modifications
- Use fragments for reusable query parts
- Implement proper error handling and loading states
- Leverage TypeScript for type safety with GraphQL operations

## Project Structure

```
src/
  components/
  graphql/
    queries/
      users.ts
      posts.ts
    mutations/
      users.ts
      posts.ts
    fragments/
      user.ts
      post.ts
  hooks/
    useUser.ts
    usePosts.ts
  pages/
  utils/
    apollo-client.ts
  types/
    generated/           # Generated TypeScript types
```

## Setup and Configuration

### Apollo Client Setup

```typescript
// utils/apollo-client.ts
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT,
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Path: ${path}`);
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
```

### Apollo Provider Setup

```typescript
// pages/_app.tsx or app/providers.tsx
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/utils/apollo-client';

function App({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      {children}
    </ApolloProvider>
  );
}
```

## Schema Design Best Practices

### Naming Conventions

Use descriptive naming for types, fields, and arguments:

```graphql
# Good
type User {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  createdAt: DateTime!
}

type Query {
  getUserById(id: ID!): User
  getUsersByRole(role: UserRole!): [User!]!
}

# Avoid
type Query {
  getUser(id: ID!): User  # Less descriptive
}
```

### Schema Structure

Define a clear schema reflecting your business domain:

```graphql
type Query {
  user(id: ID!): User
  users(first: Int, after: String, filter: UserFilter): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

input CreateUserInput {
  firstName: String!
  lastName: String!
  email: String!
}

type CreateUserPayload {
  user: User
  errors: [UserError!]
}
```

## Query Patterns

### Defining Queries with Fragments

```typescript
// graphql/fragments/user.ts
import { gql } from '@apollo/client';

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    firstName
    lastName
    email
    avatar
    createdAt
  }
`;

// graphql/queries/users.ts
import { gql } from '@apollo/client';
import { USER_FIELDS } from '../fragments/user';

export const GET_USER = gql`
  ${USER_FIELDS}
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserFields
    }
  }
`;

export const GET_USERS = gql`
  ${USER_FIELDS}
  query GetUsers($first: Int, $after: String) {
    users(first: $first, after: $after) {
      edges {
        node {
          ...UserFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
```

### Custom Query Hooks

```typescript
// hooks/useUser.ts
import { useQuery, QueryHookOptions } from '@apollo/client';
import { GET_USER } from '@/graphql/queries/users';
import { User, GetUserQuery, GetUserQueryVariables } from '@/types/generated';

export function useUser(
  id: string,
  options?: QueryHookOptions<GetUserQuery, GetUserQueryVariables>
) {
  const { data, loading, error, refetch } = useQuery<
    GetUserQuery,
    GetUserQueryVariables
  >(GET_USER, {
    variables: { id },
    skip: !id,
    ...options,
  });

  return {
    user: data?.user,
    loading,
    error,
    refetch,
  };
}
```

## Mutation Patterns

### Defining Mutations

```typescript
// graphql/mutations/users.ts
import { gql } from '@apollo/client';
import { USER_FIELDS } from '../fragments/user';

export const CREATE_USER = gql`
  ${USER_FIELDS}
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      user {
        ...UserFields
      }
      errors {
        field
        message
      }
    }
  }
`;

export const UPDATE_USER = gql`
  ${USER_FIELDS}
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      user {
        ...UserFields
      }
      errors {
        field
        message
      }
    }
  }
`;
```

### Custom Mutation Hooks

```typescript
// hooks/useCreateUser.ts
import { useMutation, MutationHookOptions } from '@apollo/client';
import { CREATE_USER } from '@/graphql/mutations/users';
import { GET_USERS } from '@/graphql/queries/users';

export function useCreateUser(options?: MutationHookOptions) {
  const [createUser, { data, loading, error }] = useMutation(CREATE_USER, {
    refetchQueries: [{ query: GET_USERS }],
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
    ...options,
  });

  return {
    createUser: (input: CreateUserInput) => createUser({ variables: { input } }),
    data,
    loading,
    error,
  };
}
```

### Optimistic Updates

```typescript
function useUpdateUser() {
  const [updateUser] = useMutation(UPDATE_USER, {
    optimisticResponse: ({ id, input }) => ({
      __typename: 'Mutation',
      updateUser: {
        __typename: 'UpdateUserPayload',
        user: {
          __typename: 'User',
          id,
          ...input,
        },
        errors: null,
      },
    }),
    update: (cache, { data }) => {
      const updatedUser = data?.updateUser?.user;
      if (updatedUser) {
        cache.modify({
          id: cache.identify(updatedUser),
          fields: {
            firstName: () => updatedUser.firstName,
            lastName: () => updatedUser.lastName,
          },
        });
      }
    },
  });

  return { updateUser };
}
```

## Caching Strategies

### Cache Normalization

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      keyFields: ['id'],
    },
    Post: {
      keyFields: ['id'],
      fields: {
        author: {
          merge: true,
        },
      },
    },
  },
});
```

### Reading and Writing Cache

```typescript
// Read from cache
const user = client.readFragment({
  id: `User:${userId}`,
  fragment: USER_FIELDS,
});

// Write to cache
client.writeFragment({
  id: `User:${userId}`,
  fragment: USER_FIELDS,
  data: {
    ...user,
    firstName: 'Updated Name',
  },
});
```

## Pagination

### Cursor-Based Pagination (Relay Style)

Cursor-based pagination is recommended for large or rapidly changing data:

```typescript
function useInfiniteUsers() {
  const { data, loading, fetchMore } = useQuery(GET_USERS, {
    variables: { first: 10 },
  });

  const loadMore = () => {
    if (!data?.users.pageInfo.hasNextPage) return;

    fetchMore({
      variables: {
        after: data.users.pageInfo.endCursor,
      },
    });
  };

  return {
    users: data?.users.edges.map((edge) => edge.node) ?? [],
    loading,
    hasMore: data?.users.pageInfo.hasNextPage ?? false,
    loadMore,
  };
}
```

### Cache Merge Policy for Pagination

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: {
          keyArgs: ['filter'],
          merge(existing = { edges: [] }, incoming) {
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
        },
      },
    },
  },
});
```

## Performance Optimization

### DataLoader Pattern

Use batching techniques to reduce backend requests:

```typescript
// Server-side with DataLoader
import DataLoader from 'dataloader';

const userLoader = new DataLoader(async (ids: string[]) => {
  const users = await db.users.findMany({ where: { id: { in: ids } } });
  return ids.map((id) => users.find((u) => u.id === id));
});

// In resolver
const resolvers = {
  Post: {
    author: (post) => userLoader.load(post.authorId),
  },
};
```

### Query Batching

```typescript
import { BatchHttpLink } from '@apollo/client/link/batch-http';

const batchLink = new BatchHttpLink({
  uri: '/graphql',
  batchMax: 10,
  batchInterval: 20,
});
```

### Fetch Policies

```typescript
// Network only - skip cache
useQuery(GET_USER, {
  fetchPolicy: 'network-only',
});

// Cache first - prefer cache
useQuery(GET_USER, {
  fetchPolicy: 'cache-first',
});

// Cache and network - return cache, then update
useQuery(GET_USER, {
  fetchPolicy: 'cache-and-network',
});
```

## Error Handling

### Query Error Handling

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useUser(userId);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <ErrorMessage
        message="Failed to load user profile"
        retry={() => refetch()}
      />
    );
  }

  return <ProfileCard user={data} />;
}
```

### Mutation Error Handling

```typescript
function CreateUserForm() {
  const { createUser, loading, error } = useCreateUser({
    onCompleted: (data) => {
      if (data.createUser.errors?.length) {
        // Handle validation errors
        data.createUser.errors.forEach((err) => {
          setFieldError(err.field, err.message);
        });
      } else {
        // Success
        toast.success('User created successfully');
      }
    },
  });

  // ...
}
```

## State Management

For simple state requirements, use Apollo Client's local state management:

```typescript
// Define local-only fields
const typeDefs = gql`
  extend type Query {
    isLoggedIn: Boolean!
    cartItems: [CartItem!]!
  }
`;

// Read local state
const IS_LOGGED_IN = gql`
  query IsLoggedIn {
    isLoggedIn @client
  }
`;

// Write local state
client.writeQuery({
  query: IS_LOGGED_IN,
  data: { isLoggedIn: true },
});
```

For complex client-side state, consider using Zustand or Redux Toolkit alongside Apollo.

## Anti-Patterns to Avoid

- **Over-fetching/Under-fetching**: Only request fields you need
- **Chatty APIs**: Minimize round trips with batching and DataLoader
- **God Objects**: Avoid large, monolithic types with too many fields
- **Missing Error Handling**: Always handle errors at query and mutation level
- **Ignoring Cache**: Leverage Apollo's caching for performance
- **Not Using Fragments**: Fragments improve reusability and maintainability
- **Skipping TypeScript**: Generate types from your schema for type safety

## Key Conventions

1. Use Apollo Provider at the root of your application
2. Implement custom hooks for Apollo operations
3. Use TypeScript for type safety with GraphQL operations (generate types)
4. Organize queries, mutations, and fragments in separate files
5. Use fragments for reusable query parts
6. Implement proper error handling and loading states
7. Use cursor-based pagination for large datasets
8. Leverage DataLoader for efficient data loading
