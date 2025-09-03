import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'BillSplitterTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function
    const handler = new lambda.Function(this, 'BillSplitterHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda permissions to DynamoDB
    table.grantReadWriteData(handler);

    // API Gateway
    const api = new apigateway.RestApi(this, 'BillSplitterApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    api.root.addMethod('GET', new apigateway.LambdaIntegration(handler));
    api.root.addMethod('POST', new apigateway.LambdaIntegration(handler));

    // S3 Bucket for static website
    const websiteBucket = new s3.Bucket(this, 'BillSplitterWebsite', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      })
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'BillSplitterDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity: new cloudfront.OriginAccessIdentity(this, 'BillSplitterOAI')
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // Deploy static files to S3 - 修改部署配置
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../', {
        exclude: ['cdk', 'node_modules', '.git', 'cdk.out'] // 排除不需要的文件夹
      })],
      destinationBucket: websiteBucket,
      distribution,
    });

    // Output the CloudFront URL and API URL
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: api.url,
    });
  }
}
