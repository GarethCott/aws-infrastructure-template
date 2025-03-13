import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { InfrastructureConfig } from '../config';

/**
 * Stack for monitoring resources (CloudWatch alarms, dashboards)
 */
export class MonitoringStack extends cdk.Stack {
  /**
   * The CloudWatch dashboard created by this stack
   */
  public readonly dashboard?: cloudwatch.Dashboard;
  
  /**
   * The SNS topic for alarms
   */
  public readonly alarmTopic?: sns.Topic;

  constructor(
    scope: Construct, 
    id: string, 
    config: InfrastructureConfig, 
    resources: {
      instance?: ec2.Instance;
      autoScalingGroup?: autoscaling.AutoScalingGroup;
      databaseInstance?: rds.IDatabaseInstance;
      functions?: Record<string, lambda.Function>;
    },
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

    // Create monitoring resources if enabled
    if (config.monitoring?.createMonitoring !== false) {
      // Create SNS topic for alarms
      this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
        topicName: `${config.projectName}-${config.environment}-alarms`,
        displayName: `${config.projectName} ${config.environment} Alarms`,
      });
      
      // Add email subscription if email is provided
      if (config.monitoring?.alarmEmail) {
        this.alarmTopic.addSubscription(
          new subscriptions.EmailSubscription(config.monitoring.alarmEmail)
        );
      }
      
      // Create alarms if enabled
      if (config.monitoring?.createAlarms !== false) {
        // EC2 instance alarms
        if (resources.instance) {
          // CPU utilization alarm
          const cpuAlarm = new cloudwatch.Alarm(this, 'InstanceCpuAlarm', {
            alarmName: `${config.projectName}-${config.environment}-instance-cpu`,
            alarmDescription: 'Alarm if CPU utilization exceeds 80% for 5 minutes',
            metric: new cloudwatch.Metric({
              namespace: 'AWS/EC2',
              metricName: 'CPUUtilization',
              dimensionsMap: {
                InstanceId: resources.instance.instanceId,
              },
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
            }),
            threshold: 80,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            actionsEnabled: true,
          });
          
          // Add alarm action after creating the alarm
          cpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
          
          // Status check alarm - only create if not in essential alarms only mode
          if (!config.monitoring?.essentialAlarmsOnly) {
            const statusCheckAlarm = new cloudwatch.Alarm(this, 'InstanceStatusCheckAlarm', {
              alarmName: `${config.projectName}-${config.environment}-instance-status`,
              alarmDescription: 'Alarm if status check fails for 5 minutes',
              metric: new cloudwatch.Metric({
                namespace: 'AWS/EC2',
                metricName: 'StatusCheckFailed',
                dimensionsMap: {
                  InstanceId: resources.instance.instanceId,
                },
                statistic: 'Maximum',
                period: cdk.Duration.minutes(5),
              }),
              threshold: 1,
              evaluationPeriods: 1,
              datapointsToAlarm: 1,
              comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
              treatMissingData: cloudwatch.TreatMissingData.BREACHING,
              actionsEnabled: true,
            });
            
            statusCheckAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
          }
        }
        
        // Auto-scaling group alarms
        if (resources.autoScalingGroup) {
          // CPU utilization alarm
          const cpuAlarm = new cloudwatch.Alarm(this, 'AsgCpuAlarm', {
            alarmName: `${config.projectName}-${config.environment}-asg-cpu`,
            alarmDescription: 'Alarm if CPU utilization exceeds 80% for 5 minutes',
            metric: new cloudwatch.Metric({
              namespace: 'AWS/EC2',
              metricName: 'CPUUtilization',
              dimensionsMap: {
                AutoScalingGroupName: resources.autoScalingGroup.autoScalingGroupName,
              },
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
            }),
            threshold: 80,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            actionsEnabled: true,
          });
          
          // Add alarm action after creating the alarm
          cpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
        }
        
        // RDS instance alarms
        if (resources.databaseInstance) {
          // CPU utilization alarm
          const cpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
            alarmName: `${config.projectName}-${config.environment}-rds-cpu`,
            alarmDescription: 'Alarm if CPU utilization exceeds 80% for 5 minutes',
            metric: new cloudwatch.Metric({
              namespace: 'AWS/RDS',
              metricName: 'CPUUtilization',
              dimensionsMap: {
                DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
              },
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
            }),
            threshold: 80,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            actionsEnabled: true,
          });
          
          // Add alarm action after creating the alarm
          cpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
          
          // Free storage space alarm - only create if not in essential alarms only mode
          if (!config.monitoring?.essentialAlarmsOnly) {
            new cloudwatch.Alarm(this, 'RdsFreeStorageSpaceAlarm', {
              alarmName: `${config.projectName}-${config.environment}-rds-storage`,
              alarmDescription: 'Alarm if free storage space is less than 10% of allocated storage',
              metric: new cloudwatch.Metric({
                namespace: 'AWS/RDS',
                metricName: 'FreeStorageSpace',
                dimensionsMap: {
                  DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
              }),
              threshold: 1024 * 1024 * 1024, // 1 GB in bytes
              evaluationPeriods: 1,
              datapointsToAlarm: 1,
              comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
              treatMissingData: cloudwatch.TreatMissingData.BREACHING,
              actionsEnabled: true,
            });
          }
        }
        
        // Lambda function alarms - only create essential alarms in essential alarms only mode
        if (resources.functions && !config.monitoring?.essentialAlarmsOnly) {
          for (const [functionName, lambdaFunction] of Object.entries(resources.functions)) {
            // Error alarm
            const errorAlarm = new cloudwatch.Alarm(this, `${functionName}ErrorAlarm`, {
              alarmName: `${config.projectName}-${config.environment}-${functionName}-errors`,
              alarmDescription: `Alarm if ${functionName} function has errors`,
              metric: new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                dimensionsMap: {
                  FunctionName: lambdaFunction.functionName,
                },
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
              }),
              threshold: 1,
              evaluationPeriods: 1,
              datapointsToAlarm: 1,
              comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
              treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
              actionsEnabled: true,
            });
            
            // Add alarm action after creating the alarm
            errorAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
            
            // Duration alarm
            const durationAlarm = new cloudwatch.Alarm(this, `${functionName}DurationAlarm`, {
              alarmName: `${config.projectName}-${config.environment}-${functionName}-duration`,
              alarmDescription: `Alarm if ${functionName} function duration exceeds 1000ms`,
              metric: new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                dimensionsMap: {
                  FunctionName: lambdaFunction.functionName,
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
              }),
              threshold: 1000,
              evaluationPeriods: 3,
              datapointsToAlarm: 3,
              comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
              treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
              actionsEnabled: true,
            });
            
            durationAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
          }
        }
      }
      
      // Create dashboard if enabled
      if (config.monitoring?.createDashboard) {
        this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
          dashboardName: `${config.projectName}-${config.environment}-dashboard`,
        });
        
        // Create a simplified dashboard for dev environment to stay within free tier
        const isDevEnvironment = config.environment === 'dev';
        
        // Add EC2 instance widgets
        if (resources.instance) {
          // For dev environment, only add CPU utilization widget
          if (isDevEnvironment) {
            this.dashboard.addWidgets(
              new cloudwatch.GraphWidget({
                title: 'EC2 CPU Utilization',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/EC2',
                    metricName: 'CPUUtilization',
                    dimensionsMap: {
                      InstanceId: resources.instance.instanceId,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              })
            );
          } else {
            // For other environments, add all widgets
            this.dashboard.addWidgets(
              new cloudwatch.GraphWidget({
                title: 'EC2 Instance CPU Utilization',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/EC2',
                    metricName: 'CPUUtilization',
                    dimensionsMap: {
                      InstanceId: resources.instance.instanceId,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              }),
              new cloudwatch.GraphWidget({
                title: 'EC2 Instance Network',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/EC2',
                    metricName: 'NetworkIn',
                    dimensionsMap: {
                      InstanceId: resources.instance.instanceId,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
                right: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/EC2',
                    metricName: 'NetworkOut',
                    dimensionsMap: {
                      InstanceId: resources.instance.instanceId,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              })
            );
          }
        }
        
        // Add Auto-scaling group widgets
        if (resources.autoScalingGroup) {
          this.dashboard.addWidgets(
            new cloudwatch.GraphWidget({
              title: 'Auto-scaling Group CPU Utilization',
              left: [
                new cloudwatch.Metric({
                  namespace: 'AWS/EC2',
                  metricName: 'CPUUtilization',
                  dimensionsMap: {
                    AutoScalingGroupName: resources.autoScalingGroup.autoScalingGroupName,
                  },
                  statistic: 'Average',
                  period: cdk.Duration.minutes(5),
                }),
              ],
            }),
            new cloudwatch.GraphWidget({
              title: 'Auto-scaling Group Size',
              left: [
                new cloudwatch.Metric({
                  namespace: 'AWS/AutoScaling',
                  metricName: 'GroupInServiceInstances',
                  dimensionsMap: {
                    AutoScalingGroupName: resources.autoScalingGroup.autoScalingGroupName,
                  },
                  statistic: 'Average',
                  period: cdk.Duration.minutes(5),
                }),
              ],
            })
          );
        }
        
        // Add RDS instance widgets
        if (resources.databaseInstance) {
          // For dev environment, only add CPU utilization widget
          if (isDevEnvironment) {
            this.dashboard.addWidgets(
              new cloudwatch.GraphWidget({
                title: 'RDS CPU Utilization',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'CPUUtilization',
                    dimensionsMap: {
                      DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              })
            );
          } else {
            // For other environments, add all widgets
            this.dashboard.addWidgets(
              new cloudwatch.GraphWidget({
                title: 'RDS CPU Utilization',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'CPUUtilization',
                    dimensionsMap: {
                      DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              }),
              new cloudwatch.GraphWidget({
                title: 'RDS Connections',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'DatabaseConnections',
                    dimensionsMap: {
                      DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              }),
              new cloudwatch.GraphWidget({
                title: 'RDS Storage',
                left: [
                  new cloudwatch.Metric({
                    namespace: 'AWS/RDS',
                    metricName: 'FreeStorageSpace',
                    dimensionsMap: {
                      DBInstanceIdentifier: resources.databaseInstance.instanceIdentifier,
                    },
                    statistic: 'Average',
                    period: cdk.Duration.minutes(5),
                  }),
                ],
              })
            );
          }
        }
        
        // Add Lambda function widgets
        if (resources.functions) {
          // For dev environment, only add essential Lambda metrics
          if (isDevEnvironment) {
            // Add a single widget for all Lambda functions
            const metrics: cloudwatch.IMetric[] = [];
            
            for (const [functionName, lambdaFunction] of Object.entries(resources.functions)) {
              metrics.push(
                new cloudwatch.Metric({
                  namespace: 'AWS/Lambda',
                  metricName: 'Invocations',
                  dimensionsMap: {
                    FunctionName: lambdaFunction.functionName,
                  },
                  statistic: 'Sum',
                  period: cdk.Duration.minutes(5),
                })
              );
            }
            
            if (metrics.length > 0) {
              this.dashboard.addWidgets(
                new cloudwatch.GraphWidget({
                  title: 'Lambda Invocations',
                  left: metrics,
                })
              );
            }
          } else {
            // For other environments, add detailed widgets for each function
            for (const [functionName, lambdaFunction] of Object.entries(resources.functions)) {
              // Error alarm
              const errorAlarm = new cloudwatch.Alarm(this, `${functionName}ErrorAlarm`, {
                alarmName: `${config.projectName}-${config.environment}-${functionName}-errors`,
                alarmDescription: `Alarm if ${functionName} function has errors`,
                metric: new cloudwatch.Metric({
                  namespace: 'AWS/Lambda',
                  metricName: 'Errors',
                  dimensionsMap: {
                    FunctionName: lambdaFunction.functionName,
                  },
                  statistic: 'Sum',
                  period: cdk.Duration.minutes(5),
                }),
                threshold: 1,
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
                actionsEnabled: true,
              });
              
              // Add alarm action after creating the alarm
              errorAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
              
              // Duration alarm
              const durationAlarm = new cloudwatch.Alarm(this, `${functionName}DurationAlarm`, {
                alarmName: `${config.projectName}-${config.environment}-${functionName}-duration`,
                alarmDescription: `Alarm if ${functionName} function duration exceeds 1000ms`,
                metric: new cloudwatch.Metric({
                  namespace: 'AWS/Lambda',
                  metricName: 'Duration',
                  dimensionsMap: {
                    FunctionName: lambdaFunction.functionName,
                  },
                  statistic: 'Average',
                  period: cdk.Duration.minutes(5),
                }),
                threshold: 1000,
                evaluationPeriods: 3,
                datapointsToAlarm: 3,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
                actionsEnabled: true,
              });
              
              durationAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));
            }
          }
        }
      }
      
      // Output alarm topic ARN
      new cdk.CfnOutput(this, 'AlarmTopicArn', {
        value: this.alarmTopic.topicArn,
        description: 'The ARN of the alarm SNS topic',
        exportName: `${config.projectName}-${config.environment}-alarm-topic-arn`,
      });
      
      // Output dashboard name
      if (this.dashboard) {
        new cdk.CfnOutput(this, 'DashboardName', {
          value: this.dashboard.dashboardName,
          description: 'The name of the CloudWatch dashboard',
          exportName: `${config.projectName}-${config.environment}-dashboard-name`,
        });
      }
    }
  }
} 