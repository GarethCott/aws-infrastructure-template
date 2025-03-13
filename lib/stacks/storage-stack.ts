import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { InfrastructureConfig } from '../config';

/**
 * Stack for storage resources (S3 buckets, CloudFront distributions)
 */
export class StorageStack extends cdk.Stack {
  /**
   * The S3 bucket created by this stack
   */
  public readonly bucket?: s3.IBucket;
  
  /**
   * The CloudFront distribution created by this stack
   */
  public readonly distribution?: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, config: InfrastructureConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // Apply tags to all resources in this stack
    if (config.tags) {
      Object.entries(config.tags).forEach(([key, value]) => {
        cdk.Tags.of(this).add(key, value);
      });
    }
    
    // Add default tags
    cdk.Tags.of(this).add('Project', config.projectName);
    cdk.Tags.of(this).add('Environment', config.environment);

    // Create S3 bucket if enabled
    if (config.storage?.createBucket !== false) {
      // Define CORS configuration if enabled
      let corsRules;
      if (config.storage?.enableCors !== false) {
        corsRules = [
          {
            allowedMethods: (config.storage?.corsAllowedMethods || ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'])
              .map(method => s3.HttpMethods[method as keyof typeof s3.HttpMethods]),
            allowedOrigins: config.storage?.corsAllowedOrigins || ['*'],
            allowedHeaders: ['*'],
            maxAge: 3000,
          },
        ];
      }
      
      // Define lifecycle rules if enabled
      let lifecycleRules;
      if (config.storage?.enableLifecycle) {
        lifecycleRules = [
          {
            enabled: true,
            transitions: [
              {
                storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                transitionAfter: cdk.Duration.days(config.storage?.transitionToIaAfterDays || 30),
              },
            ],
            // Only set expiration if expireAfterDays is specified
            ...(config.storage?.expireAfterDays ? {
              expiration: cdk.Duration.days(config.storage?.expireAfterDays)
            } : {})
          },
        ];
      }
      
      // Create the bucket
      this.bucket = new s3.Bucket(this, 'Bucket', {
        bucketName: config.storage?.bucketName,
        versioned: config.storage?.enableVersioning,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: config.environment === 'prod' 
          ? cdk.RemovalPolicy.RETAIN 
          : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: config.environment !== 'prod',
        cors: corsRules,
        lifecycleRules: config.environment === 'dev' && config.storage?.enableLifecycle
          ? [
              {
                // For dev environment, optimize storage costs without expiration
                enabled: true,
                transitions: [
                  {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(config.storage?.transitionToIaAfterDays || 30),
                  },
                ],
                // No expiration set - objects will remain indefinitely
                // Only expire non-current versions if versioning is enabled
                ...(config.storage?.enableVersioning ? {
                  noncurrentVersionExpiration: cdk.Duration.days(30)
                } : {})
              },
            ]
          : lifecycleRules,
      });
      
      // Create CloudFront distribution if enabled
      if (config.storage?.createDistribution) {
        // Create log bucket only if not in dev environment
        const logBucket = config.environment !== 'dev' ? 
          new s3.Bucket(this, 'LogBucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [
              {
                expiration: cdk.Duration.days(30),
              },
            ],
          }) : undefined;
        
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
          defaultBehavior: {
            origin: new origins.S3Origin(this.bucket),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use the cheapest price class
          enableLogging: config.environment !== 'dev', // Disable logging in dev environment
          logBucket,
          logFilePrefix: config.environment !== 'dev' ? 'cloudfront-logs/' : undefined,
        });
        
        // Output CloudFront domain name
        new cdk.CfnOutput(this, 'DistributionDomainName', {
          value: this.distribution.distributionDomainName,
          description: 'The domain name of the CloudFront distribution',
          exportName: `${config.projectName}-${config.environment}-cf-domain`,
        });
      }
      
      // Create IAM policy for bucket access
      const bucketPolicy = new iam.ManagedPolicy(this, 'BucketPolicy', {
        managedPolicyName: `${config.projectName}-${config.environment}-bucket-policy`,
        statements: [
          new iam.PolicyStatement({
            actions: [
              's3:ListBucket',
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
            ],
            resources: [
              this.bucket.bucketArn,
              `${this.bucket.bucketArn}/*`,
            ],
          }),
        ],
      });
      
      // Output bucket name and ARN
      new cdk.CfnOutput(this, 'BucketName', {
        value: this.bucket.bucketName,
        description: 'The name of the S3 bucket',
        exportName: `${config.projectName}-${config.environment}-bucket-name`,
      });
      
      new cdk.CfnOutput(this, 'BucketArn', {
        value: this.bucket.bucketArn,
        description: 'The ARN of the S3 bucket',
        exportName: `${config.projectName}-${config.environment}-bucket-arn`,
      });
      
      new cdk.CfnOutput(this, 'BucketPolicyArn', {
        value: bucketPolicy.managedPolicyArn,
        description: 'The ARN of the bucket policy',
        exportName: `${config.projectName}-${config.environment}-bucket-policy-arn`,
      });
    }
  }
} 