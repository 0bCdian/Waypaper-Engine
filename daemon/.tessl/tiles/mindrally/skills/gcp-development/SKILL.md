---
name: gcp-development
description: Google Cloud Platform (GCP) development best practices for Cloud Functions, Cloud Run, Firestore, BigQuery, and Infrastructure as Code.
---

# GCP Development Best Practices

## Overview

This skill provides comprehensive guidelines for developing applications on Google Cloud Platform (GCP), covering serverless computing, data services, Infrastructure as Code with Terraform, and security best practices.

## Core Principles

- Write clean, well-structured code using GCP client libraries
- Use Infrastructure as Code (Terraform) for all infrastructure management
- Follow Google Cloud security best practices and compliance guidelines
- Implement comprehensive logging with Cloud Logging and monitoring with Cloud Monitoring

## Code Organization and Structure

### Terraform Module Structure
```
infrastructure/
├── main.tf           # Primary resources
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── versions.tf       # Provider versions
├── terraform.tfvars  # Variable values
└── modules/
    ├── compute/
    ├── storage/
    └── networking/
```

### Application Structure
```
src/
├── functions/        # Cloud Functions
├── services/         # Cloud Run services
├── shared/           # Shared utilities
└── tests/            # Test files
```

## Cloud Functions Guidelines

### Function Configuration
```typescript
import { HttpFunction } from '@google-cloud/functions-framework';

export const helloWorld: HttpFunction = async (req, res) => {
  try {
    // Validate request
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Business logic
    const result = await processRequest(req.body);

    res.status(200).json(result);
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
```

### Best Practices
- Use 2nd generation Cloud Functions for better performance
- Set appropriate memory and timeout limits
- Use environment variables for configuration
- Implement proper error handling and logging
- Use connection pooling for database connections

## Cloud Run Guidelines

### Container Best Practices
- Use distroless or minimal base images
- Implement health check endpoints
- Handle SIGTERM for graceful shutdown
- Use Cloud Run services for HTTP workloads
- Use Cloud Run jobs for batch processing

### Dockerfile Example
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["dist/index.js"]
```

### Service Configuration
```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-service
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT_ID/my-service
          resources:
            limits:
              memory: 512Mi
              cpu: '1'
          env:
            - name: NODE_ENV
              value: production
```

## Firestore Guidelines

### Data Modeling
- Design collections around query patterns
- Use subcollections for hierarchical data
- Implement composite indexes for complex queries
- Use batch writes for multiple document updates

### Best Practices
```typescript
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore();

// Use transactions for atomic operations
await db.runTransaction(async (transaction) => {
  const docRef = db.collection('users').doc(userId);
  const doc = await transaction.get(docRef);

  if (!doc.exists) {
    throw new Error('User not found');
  }

  transaction.update(docRef, {
    lastLogin: Firestore.FieldValue.serverTimestamp()
  });
});
```

## BigQuery Guidelines

### Query Best Practices
- Use partitioned and clustered tables
- Avoid SELECT * in production queries
- Use parameterized queries to prevent SQL injection
- Implement query caching where appropriate

### Cost Optimization
- Set up budget alerts
- Use slot reservations for predictable workloads
- Archive old data to Cloud Storage
- Use materialized views for repeated queries

## Cloud Storage Guidelines

### Bucket Configuration
- Use uniform bucket-level access
- Enable versioning for important data
- Set lifecycle rules for automatic cleanup
- Use signed URLs for temporary access

### Best Practices
```typescript
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const bucket = storage.bucket('my-bucket');

// Generate signed URL for upload
const [url] = await bucket.file('uploads/file.pdf').getSignedUrl({
  version: 'v4',
  action: 'write',
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  contentType: 'application/pdf',
});
```

## Terraform Best Practices

### Provider Configuration
```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "my-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
```

### Module Best Practices
- Use versioned modules from Terraform Registry
- Lock provider versions for consistency
- Use workspaces for environment separation
- Store state in Cloud Storage with encryption

## Security Best Practices

### IAM Configuration
- Use service accounts with minimal permissions
- Implement Workload Identity for GKE
- Use IAM Conditions for fine-grained access
- Regular audit with Policy Analyzer

### Secret Management
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/PROJECT_ID/secrets/${secretName}/versions/latest`,
  });

  return version.payload?.data?.toString() || '';
}
```

### Network Security
- Use VPC Service Controls for sensitive data
- Implement Cloud Armor for DDoS protection
- Use Private Google Access for internal services
- Configure firewall rules with least privilege

## Deployment Best Practices

### Blue/Green Deployments
- Use traffic splitting in Cloud Run
- Implement health checks before traffic shift
- Have rollback strategy ready
- Use Cloud Deploy for managed deployments

### CI/CD with Cloud Build
```yaml
# cloudbuild.yaml
steps:
  - name: 'node:20'
    entrypoint: npm
    args: ['ci']

  - name: 'node:20'
    entrypoint: npm
    args: ['test']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/my-service', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/my-service']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'my-service'
      - '--image=gcr.io/$PROJECT_ID/my-service'
      - '--region=us-central1'
```

## Observability

### Cloud Logging
- Use structured logging in JSON format
- Include trace IDs for distributed tracing
- Set up log-based metrics for monitoring
- Configure log sinks for long-term storage

### Cloud Monitoring
- Create SLIs and SLOs for services
- Set up alerting policies for critical metrics
- Use custom metrics for business KPIs
- Implement uptime checks for endpoints

### Cloud Trace
```typescript
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new BatchSpanProcessor(new TraceExporter())
);
provider.register();
```

## Debugging Strategies

- Use Cloud Debugger for production debugging
- Implement error reporting with Error Reporting
- Use Cloud Profiler for performance analysis
- Test locally with emulators before deployment

## Recommended Tools

- **gcloud CLI**: Command-line interaction with GCP
- **Terraform**: Infrastructure as Code
- **Cloud Code VS Code Extension**: IDE integration
- **Docker**: Local containerization
- **Emulator Suite**: Local testing for Firestore, Pub/Sub, etc.

## Common Pitfalls to Avoid

1. Not using service accounts for workloads
2. Hardcoding project IDs or credentials
3. Ignoring cold start optimization for Cloud Functions
4. Not setting up proper IAM bindings
5. Missing Cloud Monitoring alerts
6. Over-provisioning resources
7. Not using VPC for sensitive workloads
8. Ignoring cost optimization best practices
