import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import { InfrastructureConfig } from '../config';

/**
 * Stack for compute resources (EC2 instances, auto-scaling groups)
 */
export class ComputeStack extends cdk.Stack {
  /**
   * The EC2 instance created by this stack
   */
  public readonly instance?: ec2.Instance;
  
  /**
   * The auto-scaling group created by this stack
   */
  public readonly autoScalingGroup?: autoscaling.AutoScalingGroup;

  constructor(
    scope: Construct, 
    id: string, 
    config: InfrastructureConfig, 
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup,
    props?: cdk.StackProps
  ) {
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

    // Create compute resources if enabled
    if (config.compute?.createCompute) {
      // Create IAM role for EC2 instances
      const instanceRole = new iam.Role(this, 'InstanceRole', {
        roleName: `${config.projectName}-${config.environment}-instance-role`,
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        ],
      });
      
      // Set instance type based on environment
      const instanceType = config.compute?.instanceType || 
        ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, 
          config.environment === 'prod' ? ec2.InstanceSize.MEDIUM : ec2.InstanceSize.SMALL);
      
      // Create auto scaling group if enabled
      if (config.compute.useAutoScaling) {
        this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
          vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          securityGroup,
          instanceType,
          machineImage: ec2.MachineImage.fromSsmParameter(
            '/aws/service/canonical/ubuntu/server/22.04/stable/current/arm64/hvm/ebs-gp2/ami-id'
          ),
          role: instanceRole,
          minCapacity: config.compute.minInstances || 1,
          maxCapacity: config.compute.maxInstances || 3,
          desiredCapacity: config.compute.desiredInstances || 2,
          healthCheck: autoscaling.HealthCheck.elb({ grace: cdk.Duration.seconds(60) }),
          updatePolicy: autoscaling.UpdatePolicy.rollingUpdate(),
        });
        
        // Add CPU-based scaling
        this.autoScalingGroup.scaleOnCpuUtilization('CpuScaling', {
          targetUtilizationPercent: 70,
          cooldown: cdk.Duration.seconds(300),
        });
        
        // Add memory-based scaling
        this.autoScalingGroup.scaleOnMetric('MemoryScaling', {
          metric: new cdk.aws_cloudwatch.Metric({
            namespace: 'System/Linux',
            metricName: 'MemoryUtilization',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
          scalingSteps: [
            { upper: 50, change: -1 },
            { lower: 70, change: +1 },
          ],
          adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
          cooldown: cdk.Duration.seconds(300),
        });
      } else {
        // Create single EC2 instance
        this.instance = new ec2.Instance(this, 'Instance', {
          vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PUBLIC,
          },
          securityGroup,
          instanceType: config.compute.instanceType || 
            ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
          machineImage: ec2.MachineImage.fromSsmParameter(
            '/aws/service/canonical/ubuntu/server/22.04/stable/current/arm64/hvm/ebs-gp2/ami-id'
          ),
          keyName: config.compute.keyName,
          role: instanceRole,
          userData: ec2.UserData.forLinux(),
          blockDevices: [
            {
              deviceName: '/dev/xvda',
              volume: ec2.BlockDeviceVolume.ebs(20, {
                encrypted: true,
                volumeType: ec2.EbsDeviceVolumeType.GP3,
                deleteOnTermination: true,
              }),
            },
          ],
        });
        
        // Output instance ID
        new cdk.CfnOutput(this, 'InstanceId', {
          value: this.instance.instanceId,
          description: 'The ID of the EC2 instance',
          exportName: `${config.projectName}-${config.environment}-instance-id`,
        });
      }
      
      // Output instance role ARN
      new cdk.CfnOutput(this, 'InstanceRoleArn', {
        value: instanceRole.roleArn,
        description: 'The ARN of the instance role',
        exportName: `${config.projectName}-${config.environment}-instance-role-arn`,
      });
    }
  }
} 