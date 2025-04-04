import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { InfrastructureConfig } from '../config';

/**
 * Stack for network resources (VPC, subnets, security groups)
 */
export class NetworkStack extends cdk.Stack {
  /**
   * The VPC created or imported by this stack
   */
  public readonly vpc: ec2.IVpc;
  
  /**
   * Security group for database access
   */
  public readonly databaseSecurityGroup: ec2.ISecurityGroup;
  
  /**
   * Security group for application access
   */
  public readonly applicationSecurityGroup: ec2.ISecurityGroup;

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

    // Create or import VPC
    if (config.network?.createVpc === false && config.network?.vpcId) {
      // Import existing VPC
      this.vpc = ec2.Vpc.fromLookup(this, 'VPC', {
        vpcId: config.network.vpcId,
      });
      
      // Output VPC ID
      new cdk.CfnOutput(this, 'VpcId', {
        value: this.vpc.vpcId,
        description: 'The ID of the VPC',
        exportName: `${config.projectName}-${config.environment}-vpc-id`,
      });
    } else {
      // Create new VPC
      this.vpc = new ec2.Vpc(this, 'VPC', {
        cidr: config.network?.vpcCidr || '10.0.0.0/16',
        maxAzs: config.network?.maxAzs || 2,
        natGateways: config.network?.natGateways ? undefined : 0,
        subnetConfiguration: [
          {
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            cidrMask: 24,
          },
          {
            name: 'Isolated',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            cidrMask: 24,
          },
        ],
      });
      
      // Output VPC ID
      new cdk.CfnOutput(this, 'VpcId', {
        value: this.vpc.vpcId,
        description: 'The ID of the VPC',
        exportName: `${config.projectName}-${config.environment}-vpc-id`,
      });
    }

    // Create security groups
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for database access',
      securityGroupName: `${config.projectName}-${config.environment}-database-sg`,
    });

    this.applicationSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for application access',
      securityGroupName: `${config.projectName}-${config.environment}-application-sg`,
    });

    // Allow Hasura and application access
    this.applicationSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    );
    
    this.applicationSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS access'
    );

    // Allow database access from application security group
    this.databaseSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from application'
    );
    
    // Allow direct database access for Hasura Cloud
    // Hasura Cloud IP ranges (these are examples, check Hasura documentation for actual IPs)
    const hasuraCloudIpRanges = [
      '3.214.110.66/32',   // Example Hasura Cloud IP
      '3.214.110.67/32',   // Example Hasura Cloud IP
      '3.214.110.68/32',   // Example Hasura Cloud IP
      '0.0.0.0/0'          // For development, allow all IPs (remove in production)
    ];
    
    // Add Hasura Cloud IP ranges to database security group
    for (const ipRange of hasuraCloudIpRanges) {
      this.databaseSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(ipRange),
        ec2.Port.tcp(5432),
        `Allow PostgreSQL access from Hasura Cloud (${ipRange})`
      );
    }
    
    // Allow direct database access for development
    if (config.environment === 'dev') {
      this.databaseSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(5432),
        'Allow direct PostgreSQL access for development'
      );
    }

    // Add IP whitelist to security groups if specified
    if (config.network?.ipWhitelist && config.network.ipWhitelist.length > 0) {
      for (const ip of config.network.ipWhitelist) {
        this.databaseSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(5432),
          `Allow access from ${ip}`
        );
        
        this.applicationSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(22),
          `Allow SSH access from ${ip}`
        );
        
        this.applicationSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(80),
          `Allow HTTP access from ${ip}`
        );
        
        this.applicationSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(443),
          `Allow HTTPS access from ${ip}`
        );
      }
    }
    
    // Output security group IDs
    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.databaseSecurityGroup.securityGroupId,
      description: 'The ID of the database security group',
      exportName: `${config.projectName}-${config.environment}-db-sg-id`,
    });
    
    new cdk.CfnOutput(this, 'ApplicationSecurityGroupId', {
      value: this.applicationSecurityGroup.securityGroupId,
      description: 'The ID of the application security group',
      exportName: `${config.projectName}-${config.environment}-app-sg-id`,
    });

    // Add tags to security groups
    cdk.Tags.of(this.databaseSecurityGroup).add('Name', `${config.projectName}-${config.environment}-database-sg`);
    cdk.Tags.of(this.applicationSecurityGroup).add('Name', `${config.projectName}-${config.environment}-application-sg`);
  }
} 