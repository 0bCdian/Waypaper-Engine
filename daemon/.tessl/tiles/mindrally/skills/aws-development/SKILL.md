---
name: aws-development
description: AWS development best practices for Lambda, SAM, CDK, DynamoDB, IAM, and serverless architecture using Infrastructure as Code.
---

# AWS Development Best Practices

## Overview

This skill provides comprehensive guidelines for developing applications on Amazon Web Services (AWS), focusing on serverless architecture, Infrastructure as Code, and security best practices.

## Core Principles

- Write clean, well-structured code with accurate AWS SDK examples
- Use Infrastructure as Code (Terraform, CDK, SAM) for all infrastructure
- Follow the principle of least privilege for all IAM policies
- Implement comprehensive logging, metrics, and tracing for observability

## AWS Lambda Guidelines

### Configuration Standards
- Use TypeScript implementation on ARM64 architecture for better performance and cost
- Set appropriate memory and timeout values based on workload requirements
- Use environment variables for configuration, never hardcode values
- Implement proper error handling and retry logic

### Lambda Best Practices
```typescript
// Use ES modules and typed handlers
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Validate input at function start
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
    }

    // Business logic here

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('Lambda error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
```

## AWS CDK Guidelines

### Implementation Standards
- Use `aws-cdk-lib` with explicit `aws_*` prefixes
- Implement custom constructs for reusable patterns
- Separate concerns into distinct CloudFormation stacks
- Organize resources by functional groups: storage, compute, authentication, API, access

### Project Structure
```
aws/
├── constructs/     # CDK custom constructs
├── stacks/         # CloudFormation stack definitions
├── functions/      # Lambda function implementations
└── tests/          # Infrastructure tests
```

### CDK Best Practices
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws_lambda';
import * as dynamodb from 'aws-cdk-lib/aws_dynamodb';

// Use custom constructs for reusable patterns
export class ApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    // Implementation
  }
}
```

## DynamoDB Patterns

### Table Design
- Design tables around access patterns, not entity relationships
- Use single-table design when appropriate
- Implement GSIs for additional access patterns
- Use on-demand capacity for variable workloads, provisioned for predictable

### Best Practices
- Always use strongly typed item definitions
- Implement optimistic locking with version attributes
- Use batch operations for multiple items
- Enable point-in-time recovery for production tables

## IAM Security Best Practices

### Principles
- Apply least privilege: grant only permissions needed
- Use IAM roles, not access keys, for AWS service access
- Implement resource-based policies where appropriate
- Regular audit and rotate credentials

### Policy Example
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/MyTable"
    }
  ]
}
```

## SAM Template Configuration

### Template Structure
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    Architectures:
      - arm64
    Tracing: Active

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: index.handler
      Events:
        Api:
          Type: Api
          Properties:
            Path: /items
            Method: GET
```

## API Gateway Configuration

### Best Practices
- Use Cognito or IAM for authentication
- Implement request validation
- Enable CORS only when necessary
- Use usage plans and API keys for rate limiting

## Step Functions for Orchestration

- Use Step Functions for complex workflows
- Implement error handling with Catch and Retry
- Use Express workflows for high-volume, short-duration
- Use Standard workflows for long-running processes

## Security Standards

### Encryption
- Enable encryption at rest for all storage services
- Use AWS KMS for key management
- Enable encryption in transit (TLS)
- Use custom KMS keys for sensitive data

### Secrets Management
- Store secrets in AWS Secrets Manager or Parameter Store
- Never commit secrets to version control
- Rotate secrets automatically
- Use IAM roles to access secrets

## Observability

### Logging
- Use structured JSON logging
- Include correlation IDs across services
- Log at appropriate levels (INFO, WARN, ERROR)
- Enable CloudWatch Logs Insights for querying

### Monitoring
- Create CloudWatch alarms for critical metrics
- Use X-Ray for distributed tracing
- Implement custom metrics for business KPIs
- Set up dashboards for operational visibility

## Testing

### Unit Testing
- Mock AWS SDK calls in unit tests
- Use localstack or SAM local for integration testing
- Test IAM policies with policy simulator
- Validate CloudFormation/CDK with cfn-lint

### Integration Testing
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
});

test('handler returns items', async () => {
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  const result = await handler(event);
  expect(result.statusCode).toBe(200);
});
```

## CI/CD Integration

- Use AWS CodePipeline or GitHub Actions for CI/CD
- Run `cdk diff` or `sam validate` before deployment
- Implement staging environments (dev, staging, prod)
- Use parameter overrides for environment-specific config

## Common Pitfalls to Avoid

1. Hardcoding AWS credentials or secrets
2. Not setting appropriate Lambda timeouts
3. Ignoring cold start optimization
4. Over-provisioning resources
5. Not implementing proper error handling
6. Missing CloudWatch alarms
7. Inadequate IAM policies (too permissive)
8. Not using VPC when required for compliance
