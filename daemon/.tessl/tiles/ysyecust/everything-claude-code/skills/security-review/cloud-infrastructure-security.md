| name | description |
|------|-------------|
| cloud-infrastructure-security | Use this skill when deploying to cloud platforms, configuring infrastructure, managing IAM policies, setting up logging/monitoring, or implementing CI/CD pipelines. Provides cloud security checklist aligned with best practices. |

# Cloud & Infrastructure Security Skill

This skill ensures cloud infrastructure, CI/CD pipelines, and deployment configurations follow security best practices and comply with industry standards.

## When to Activate

- Deploying applications to cloud platforms (AWS, GCP, Azure)
- Configuring IAM roles and permissions
- Setting up CI/CD pipelines
- Implementing infrastructure as code (Terraform, CloudFormation)
- Configuring logging and monitoring
- Managing secrets in cloud environments
- Setting up CDN and edge security
- Implementing disaster recovery and backup strategies

## Cloud Security Checklist

### 1. IAM & Access Control

#### Principle of Least Privilege

```yaml
# CORRECT: Minimal permissions
iam_role:
  permissions:
    - s3:GetObject  # Only read access
    - s3:ListBucket
  resources:
    - arn:aws:s3:::my-bucket/*  # Specific bucket only

# WRONG: Overly broad permissions
iam_role:
  permissions:
    - s3:*  # All S3 actions
  resources:
    - "*"  # All resources
```

#### Verification Steps

- [ ] No root account usage in production
- [ ] MFA enabled for all privileged accounts
- [ ] Service accounts use roles, not long-lived credentials
- [ ] IAM policies follow least privilege
- [ ] Regular access reviews conducted
- [ ] Unused credentials rotated or removed

### 2. Secrets Management

#### Verification Steps

- [ ] All secrets stored in cloud secrets manager
- [ ] Automatic rotation enabled for database credentials
- [ ] API keys rotated at least quarterly
- [ ] No secrets in code, logs, or error messages
- [ ] Audit logging enabled for secret access

### 3. Network Security

#### Verification Steps

- [ ] Database not publicly accessible
- [ ] SSH/RDP ports restricted to VPN/bastion only
- [ ] Security groups follow least privilege
- [ ] Network ACLs configured
- [ ] VPC flow logs enabled

### 4. Logging & Monitoring

#### Verification Steps

- [ ] CloudWatch/logging enabled for all services
- [ ] Failed authentication attempts logged
- [ ] Admin actions audited
- [ ] Log retention configured (90+ days for compliance)
- [ ] Alerts configured for suspicious activity
- [ ] Logs centralized and tamper-proof

### 5. CI/CD Pipeline Security

#### Secure Pipeline Configuration

```yaml
# CORRECT: Secure GitHub Actions workflow
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Minimal permissions

    steps:
      - uses: actions/checkout@v4

      # Scan for secrets
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main

      # Use OIDC, not long-lived tokens
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
          aws-region: us-east-1
```

#### Verification Steps

- [ ] OIDC used instead of long-lived credentials
- [ ] Secrets scanning in pipeline
- [ ] Dependency vulnerability scanning
- [ ] Container image scanning (if applicable)
- [ ] Branch protection rules enforced
- [ ] Code review required before merge
- [ ] Signed commits enforced

### 6. Backup & Disaster Recovery

#### Verification Steps

- [ ] Automated daily backups configured
- [ ] Backup retention meets compliance requirements
- [ ] Point-in-time recovery enabled
- [ ] Backup testing performed quarterly
- [ ] Disaster recovery plan documented
- [ ] RPO and RTO defined and tested

## Pre-Deployment Cloud Security Checklist

Before ANY production cloud deployment:

- [ ] **IAM**: Root account not used, MFA enabled, least privilege policies
- [ ] **Secrets**: All secrets in cloud secrets manager with rotation
- [ ] **Network**: Security groups restricted, no public databases
- [ ] **Logging**: CloudWatch/logging enabled with retention
- [ ] **Monitoring**: Alerts configured for anomalies
- [ ] **CI/CD**: OIDC auth, secrets scanning, dependency audits
- [ ] **Encryption**: Data encrypted at rest and in transit
- [ ] **Backups**: Automated backups with tested recovery
- [ ] **Compliance**: GDPR/HIPAA requirements met (if applicable)
- [ ] **Documentation**: Infrastructure documented, runbooks created
- [ ] **Incident Response**: Security incident plan in place

## Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [OWASP Cloud Security](https://owasp.org/www-project-cloud-security/)
- [Terraform Security Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/)

**Remember**: Cloud misconfigurations are the leading cause of data breaches. A single exposed S3 bucket or overly permissive IAM policy can compromise your entire infrastructure. Always follow the principle of least privilege and defense in depth.
