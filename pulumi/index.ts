import * as aws from '@pulumi/aws';

const bucketName = "brainshare-primary";

const bucket = new aws.s3.Bucket(bucketName, {});
