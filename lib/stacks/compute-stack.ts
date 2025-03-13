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
        ],
      });
      
      // Create instance profile
      const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
        roles: [instanceRole.roleName],
        instanceProfileName: `${config.projectName}-${config.environment}-instance-profile`,
      });
      
      // Get latest Amazon Linux 2 AMI
      const ami = config.compute.amiId ? 
        ec2.MachineImage.genericLinux({
          [this.region]: config.compute.amiId,
        }) : 
        ec2.MachineImage.latestAmazonLinux2({
          cpuType: ec2.AmazonLinuxCpuType.X86_64,
        });
      
      // Create user data script
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        'yum update -y',
        'yum install -y amazon-cloudwatch-agent',
        'systemctl enable amazon-cloudwatch-agent',
        'systemctl start amazon-cloudwatch-agent'
      );
      
      if (config.compute.userData) {
        userData.addCommands(config.compute.userData);
      }
      
      // Create auto-scaling group if enabled
      if (config.compute.createAsg) {
        this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
          vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          securityGroup,
          instanceType: config.compute.instanceType || 
            ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
          machineImage: ami,
          keyName: config.compute.keyName,
          role: instanceRole,
          minCapacity: config.compute.minCapacity || 1,
          maxCapacity: config.compute.maxCapacity || 1,
          desiredCapacity: config.compute.desiredCapacity || 1,
          userData,
          blockDevices: [
            {
              deviceName: '/dev/xvda',
              volume: autoscaling.BlockDeviceVolume.ebs(20, {
                encrypted: true,
                volumeType: autoscaling.EbsDeviceVolumeType.GP3,
                deleteOnTermination: true,
              }),
            },
          ],
        });
        
        // Output auto-scaling group name
        new cdk.CfnOutput(this, 'AutoScalingGroupName', {
          value: this.autoScalingGroup.autoScalingGroupName,
          description: 'The name of the auto-scaling group',
          exportName: `${config.projectName}-${config.environment}-asg-name`,
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
          machineImage: ami,
          keyName: config.compute.keyName,
          role: instanceRole,
          userData,
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