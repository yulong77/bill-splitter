// lib/cdk-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { RemovalPolicy } from 'aws-cdk-lib';

export class BillSplitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1) DynamoDB 表：主键 id(String)
    const table = new dynamodb.Table(this, 'PeopleTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // 开发期方便；生产建议 RETAIN
    });

    // 2) Lambda：注入表名
    const fn = new lambda.Function(this, 'PeopleFn', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'), // 指向 lambda/index.js 所在目录
      environment: { TABLE_NAME: table.tableName },
    });

    // 授权读写表
    table.grantReadWriteData(fn);

    // 3) HTTP API + CORS 预检
    const api = new apigwv2.HttpApi(this, 'Api', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
      },
    });

    // 4) 路由：根路径 ANY 指到 Lambda
    api.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('LambdaInt', fn),
    });

    // 输出 URL（注意：末尾一般就是 / ，没有 /prod）
    new cdk.CfnOutput(this, 'HttpApiUrl', { value: api.apiEndpoint });
  }
}
