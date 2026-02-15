---
name: monitoring-guidelines
description: Monitoring guidelines for applications and infrastructure including metrics collection, alerting strategies, and SLO-based monitoring
---

# Monitoring Guidelines

Apply these monitoring principles to ensure system reliability, performance visibility, and proactive issue detection.

## Core Monitoring Principles

- Monitor the four golden signals: latency, traffic, errors, and saturation
- Implement monitoring as code for reproducibility
- Design monitoring around user experience and business impact
- Use SLOs (Service Level Objectives) to guide alerting decisions
- Balance comprehensive coverage with actionable insights

## Key Metrics to Monitor

### Application Metrics
- Request rate (requests per second)
- Error rate (percentage of failed requests)
- Response time (p50, p90, p95, p99 latencies)
- Active connections and concurrent users
- Queue depths and processing times

### Infrastructure Metrics
- CPU utilization and load average
- Memory usage and available memory
- Disk I/O and available storage
- Network throughput and error rates
- Container and pod health (for Kubernetes)

### Business Metrics
- Transaction volumes and values
- User signups and conversions
- Feature usage and adoption rates
- Revenue-impacting events
- Customer satisfaction indicators

## Alerting Strategy

### Alert Design Principles
- Alert on symptoms, not causes
- Make alerts actionable with clear remediation steps
- Set appropriate severity levels (critical, warning, info)
- Avoid alert fatigue through proper threshold tuning
- Include runbook links in alert notifications

### SLO-Based Alerting
- Define SLOs for critical user journeys
- Calculate error budgets and burn rates
- Alert when error budget consumption is high
- Use multi-window, multi-burn-rate alerts
- Review and adjust SLOs quarterly

### Alert Configuration
- Set meaningful thresholds based on baseline data
- Use hysteresis to prevent flapping alerts
- Implement alert dependencies to reduce noise
- Route alerts to appropriate teams
- Configure escalation policies

## Dashboard Design

### Effective Dashboards
- Create overview dashboards for service health
- Build detailed dashboards for debugging
- Use consistent layouts and naming conventions
- Include time range selectors and drill-down capabilities
- Display SLO status prominently

### Dashboard Content
- Show current state and recent trends
- Include comparison to baseline or previous periods
- Display deployment markers for correlation
- Add annotations for significant events
- Include links to related dashboards and logs

## Monitoring Tools Integration

### Data Collection
- Use agents or sidecars for metric collection
- Implement service discovery for dynamic environments
- Configure appropriate scrape intervals
- Use push vs pull based on use case
- Ensure metric cardinality is manageable

### Data Storage and Retention
- Set retention periods based on use case
- Implement downsampling for long-term storage
- Use appropriate storage backends for scale
- Plan for disaster recovery of monitoring data
- Monitor your monitoring infrastructure

## Health Checks and Probes

- Implement liveness probes for crash detection
- Use readiness probes for traffic management
- Create deep health checks that verify dependencies
- Expose health endpoints in a standard format
- Monitor health check latency as a metric

## Incident Response

- Use monitoring data to detect incidents early
- Correlate metrics, logs, and traces during investigation
- Document findings and update monitoring post-incident
- Track MTTR (Mean Time to Recovery) metrics
- Conduct regular monitoring reviews and improvements

## Capacity Planning

- Track resource utilization trends
- Set alerts for approaching capacity limits
- Use forecasting for proactive scaling
- Document capacity requirements and headroom
- Review capacity quarterly
