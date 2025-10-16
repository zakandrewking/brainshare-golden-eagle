import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const ySweet = new aws.s3.Bucket("brainshare-y-sweet", {
  bucket: "brainshare-y-sweet-d7bac3e",
  versioning: {
    // versioning super expensive
    enabled: false,
  },
});

const user = new aws.iam.User("ySweetUser", {
  name: "ysweet-s3-user",
});

const policy = new aws.iam.Policy("ySweetBucketPolicy", {
  policy: ySweet.arn.apply((bucketArn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: bucketArn,
        },
        {
          Effect: "Allow",
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          Resource: `${bucketArn}/*`,
        },
      ],
    })
  ),
});

new aws.iam.UserPolicyAttachment("ySweetUserPolicyAttachment", {
  user: user.name,
  policyArn: policy.arn,
});

const accessKey = new aws.iam.AccessKey("ySweetAccessKey", {
  user: user.name,
});

export const ySweetAccessKeyId = accessKey.id;
export const ySweetSecretAccessKey = accessKey.secret;
export const ySweetBucketName = ySweet.bucket;
export const awsRegion = aws.config.region;
export const ySweetS3Url = pulumi.interpolate`s3://${ySweet.bucket}/`;
// to retrieve the key `pulumi stack output --show-secrets`
