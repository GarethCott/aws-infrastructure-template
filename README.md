# AWS Infrastructure Template

A reusable AWS CDK template for creating AWS infrastructure resources. This template uses environment-based configuration and focuses on essential components for modern cloud applications.

<div align="center">
  <img src="https://d1.awsstatic.com/partner-network/QuickStart/aws-quickstart-graphic.1d9bcd9bb173b94b28f23aa0981fa534599a0804.png" alt="AWS Infrastructure" width="600">
</div>

## Table of Contents

- [Features](#features)
- [Included Resources](#included-resources)
- [Infrastructure Overview](#infrastructure-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Stack Details](#stack-details)
- [Best Practices](#best-practices)
- [GitHub Repository Preparation](#github-repository-preparation)
- [License](#license)

## Features

- **Environment-based Configuration**: Single configuration system using environment variables
- **Modular Architecture**: Each AWS resource type is a separate construct that can be used independently
- **Conditional Resource Creation**: Resources are only created if specified in the configuration
- **Sensible Defaults**: Reasonable defaults for all resources with the ability to override
- **Security Best Practices**: Follows AWS security best practices by default
- **Tagging Support**: Automatic tagging of all resources for better organization and cost tracking
- **Multi-Account Support**: Easy switching between AWS accounts using profiles

## Included Resources

This template includes the following AWS resources:

- **Network**: VPC, subnets, security groups
- **Storage**: S3 buckets with lifecycle rules
- **Database**: RDS PostgreSQL instances with parameter groups
- **Authentication**: Cognito user pools and identity pools
- **Compute**: EC2 instances
- **Serverless**: Lambda infrastructure and API Gateway
- **Monitoring**: CloudWatch alarms and dashboards

## Infrastructure Overview

### Core Components

#### 1. Network (VPC)
- CIDR: `10.0.0.0/16`
- 2 Availability Zones
- NAT Gateways: Disabled (cost optimization)
- Security Groups: Allow all IPs (`0.0.0.0/0`) in dev environment

#### 2. Storage (S3)
- Bucket naming pattern: `{project-name}-{environment}-bucket`
- CORS Configuration:
  - All origins (`*`) allowed
  - Methods: GET, PUT, POST, DELETE, HEAD
- Lifecycle Rules:
  - Objects transition to IA storage after 30 days
- Features:
  - Versioning: Disabled
  - CloudFront: Disabled (cost optimization)

#### 3. Database (RDS)
- Engine: PostgreSQL 17.2
- Instance Specifications:
  - Type: t3.micro
  - Storage: 20GB GP2
  - Publicly accessible
  - Single-AZ deployment
- Backup Configuration:
  - Retention: 7 days
  - Automated backups: Enabled
- Security:
  - Credentials stored in AWS Secrets Manager
  - Deletion protection: Disabled (dev), Enabled (prod)

#### 4. Authentication (Cognito)
- User Pool:
  - Name pattern: `{project-name}-{environment}-users`
  - Self-signup: Enabled
  - MFA: Disabled
- Password Policy:
  - Minimum length: 8 characters
  - Required: lowercase, uppercase, numbers
- Identity Pool:
  - Name pattern: `{project-name}-{environment}-identity`

#### 5. Compute (EC2)
- Instance Configuration:
  - Type: t2.micro
  - Auto-scaling: Disabled
  - User data: Configurable via environment variables

#### 6. Serverless
- API Gateway:
  - Enabled
  - Stage name: 'dev'
- Lambda:
  - Infrastructure prepared
  - Functions to be created separately

#### 7. Monitoring
- CloudWatch Configuration:
  - Alarms: Essential only (free tier optimized)
  - Notifications: Sent to `ALARM_EMAIL`

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- [Node.js](https://nodejs.org/) (>= 14.x)
- [AWS CDK](https://aws.amazon.com/cdk/) installed globally (`npm install -g aws-cdk`)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/aws-infrastructure-template.git
   cd aws-infrastructure-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your AWS profile:
   ```bash
   aws configure --profile your-profile-name
   ```

4. Bootstrap your AWS environment (if not already done):
   ```bash
   AWS_PROFILE=your-profile-name cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

5. Set up your environment variables:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file with your specific values
   nano .env
   ```

## Configuration

The template uses a single environment-based configuration system. All settings can be configured through:

1. Environment variables in your `.env` file
2. System environment variables
3. Default values in `lib/config/env.ts`

### Environment Variables

The main configuration values that can be set in your `.env` file:

```bash
# AWS Account Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
AWS_PROFILE=your-profile-name

# Project Configuration
PROJECT_NAME=my-project
ENVIRONMENT=dev

# Tags
TAG_ENVIRONMENT=Development
TAG_PROJECT=MyProject
TAG_OWNER=MyTeam

# Network Configuration
VPC_CIDR=10.0.0.0/16
MAX_AZS=2

# Storage Configuration
S3_BUCKET_NAME=my-project-dev-bucket

# Database Configuration
DB_NAME=mydb

# Authentication Configuration
USER_POOL_NAME=my-project-dev-users
COGNITO_CALLBACK_URL=http://localhost:3000/callback
COGNITO_LOGOUT_URL=http://localhost:3000/

# Monitoring Configuration
ALARM_EMAIL=team@example.com
```

See the `.env.example` file for all available options.

## Project Structure

```
.
├── bin/
│   ├── app.ts           # Main CDK app entry point
│   └── env.ts           # Environment-based entry point
├── lib/
│   ├── app.ts           # Main application definition
│   ├── config/
│   │   ├── env.ts       # Environment-based configuration
│   │   ├── index.ts     # Configuration exports
│   │   └── interfaces.ts # TypeScript interfaces
│   └── stacks/          # Individual resource stacks
├── .env                 # Environment variables (create from .env.example)
└── .env.example         # Example environment variables
```

## Usage

### Deployment

Deploy the infrastructure:
```bash
# Using your AWS profile
AWS_PROFILE=your-profile-name npm run deploy:env
```

The deployment will create all resources defined in your configuration.

### Destroying Resources

To remove all created resources:
```bash
AWS_PROFILE=your-profile-name npm run destroy:env
```

### Adding New Resources

1. Create a new stack in `lib/stacks/`
2. Add the stack's configuration interface to `lib/config/interfaces.ts`
3. Add default configuration values to `lib/config/env.ts`
4. Import and use the stack in `lib/app.ts`

### Modifying Existing Resources

Each resource type is defined in its own stack file in `lib/stacks/`. You can modify these files to customize the resources to your needs.

### Lambda Development Commands

```bash
# Deploy only serverless stack
AWS_PROFILE=your-profile-name npx cdk deploy {project-name}-{environment}-serverless

# Create a new Lambda function
mkdir -p lambda/my-function
touch lambda/my-function/index.js

# Update Lambda code after deployment
aws lambda update-function-code \
  --function-name my-project-dev-my-function \
  --zip-file fileb://lambda/my-function.zip \
  --profile your-profile-name

# Invoke Lambda function locally for testing
aws lambda invoke \
  --function-name my-project-dev-my-function \
  --payload '{"key": "value"}' \
  --profile your-profile-name \
  output.json

# View CloudWatch logs for Lambda
aws logs get-log-events \
  --log-group-name /aws/lambda/my-project-dev-my-function \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/my-project-dev-my-function \
    --order-by LastEventTime \
    --descending \
    --limit 1 \
    --query 'logStreams[0].logStreamName' \
    --output text \
    --profile your-profile-name) \
  --profile your-profile-name
```

## Stack Details

### Stack Overview

| Stack Name | Main Resources | Configuration Key | Purpose |
|------------|---------------|-------------------|---------|
| NetworkStack | VPC, Subnets, Security Groups | `network` | Network infrastructure |
| StorageStack | S3 Buckets, CloudFront | `storage` | File storage and CDN |
| DatabaseStack | RDS Instances | `database` | Relational database |
| AuthStack | Cognito User/Identity Pools | `auth` | Authentication and authorization |
| ComputeStack | EC2 Instances, Auto-scaling | `compute` | Compute resources |
| ServerlessStack | Lambda, API Gateway | `serverless` | Serverless computing |
| MonitoringStack | CloudWatch Alarms, Dashboards | `monitoring` | Monitoring and alerting |

### Stack Configuration Examples

#### NetworkStack
```typescript
network: {
  createVpc: true,
  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,
  natGateways: false
}
```

#### StorageStack
```typescript
storage: {
  createBucket: true,
  bucketName: 'my-project-dev-bucket',
  enableVersioning: false,
  enableCors: true,
  createDistribution: false
}
```

#### DatabaseStack
```typescript
database: {
  createDatabase: true,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  allocatedStorage: 20,
  databaseName: 'mydb',
  publiclyAccessible: true,
  multiAz: false
}
```

#### AuthStack
```typescript
auth: {
  createAuth: true,
  userPoolName: 'my-project-dev-users',
  identityPoolName: 'my-project-dev-identity',
  selfSignUpEnabled: true,
  mfaEnabled: false,
  callbackUrls: ['http://localhost:3000/callback'],
  logoutUrls: ['http://localhost:3000/']
}
```

#### ComputeStack
```typescript
compute: {
  createCompute: true,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
  keyName: 'my-key-pair',
  createAsg: false,
  minCapacity: 1,
  maxCapacity: 1
}
```

#### ServerlessStack
```typescript
serverless: {
  createServerless: true,
  createApiGateway: true,
  apiStageName: 'dev',
  functions: [
    {
      name: 'my-function',
      handler: 'index.handler',
      runtime: 'nodejs18.x'
    }
  ]
}
```

#### MonitoringStack
```typescript
monitoring: {
  createMonitoring: true,
  createDashboard: true,
  createAlarms: true,
  alarmEmail: 'team@example.com',
  essentialAlarmsOnly: true
}
```

## Best Practices

### Environment Variables
- Never commit `.env` file to version control
- Always update `.env.example` when adding new variables
- Use meaningful default values in `env.ts`

### Security
- Use AWS Secrets Manager for sensitive values
- Follow the principle of least privilege for IAM roles
- Enable encryption for sensitive data at rest

### Cost Management
- Monitor AWS costs regularly
- Use appropriate instance sizes
- Enable lifecycle rules for S3 buckets
- Clean up resources when not needed

### Environment-Specific Configurations

#### Development Environment
- Reduced costs:
  - Single-AZ deployments
  - Minimal backup retention
  - Essential monitoring only
- Simplified security:
  - Deletion protection disabled
  - Public access allowed
  - Flexible security group rules

#### Production Environment
- Enhanced reliability:
  - Multi-AZ deployments
  - Extended backup retention
  - Full monitoring suite
- Increased security:
  - Deletion protection enabled
  - Restricted access
  - Storage encryption
  - Strict security group rules

## GitHub Repository Preparation

### Sensitive Files to Exclude

The following files contain sensitive information and should not be committed to a public repository:

1. **`.env`** - Contains environment variables including AWS account IDs
2. **`cdk.context.json`** - Contains cached AWS account-specific information

Both of these files are already added to `.gitignore`.

### Before Pushing to GitHub

1. **Check for sensitive information:**
   ```bash
   # Search for your AWS account ID in all files
   grep -r "YOUR_ACCOUNT_ID" --include="*.{ts,js,json,md}" .
   ```

2. **Verify .gitignore is working:**
   ```bash
   # This should NOT show .env or cdk.context.json
   git status
   ```

3. **Consider creating a new repository without history** if you've been working with real AWS account information.

### CDK Context File

The `cdk.context.json` file is automatically generated by the AWS CDK to cache information about your AWS environment. When someone clones your repository, the CDK will automatically generate a new context file specific to their AWS account when they run CDK commands.

## License

MIT 