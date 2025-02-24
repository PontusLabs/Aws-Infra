import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

export function createNetworking(cfg: pulumi.Config, stack: string) {
    const vpc = new awsx.ec2.Vpc(`${stack}-main-vpc`, {
        cidrBlock: "10.0.0.0/16",
        numberOfAvailabilityZones: 2,
        natGateways: { strategy: "Single" },
        enableDnsHostnames: true,
        enableDnsSupport: true,
    });

    // VPC DNS settings
    const vpcDnsSettings = new aws.ec2.VpcDhcpOptions(`${stack}-vpc-dns-settings`, {
        domainNameServers: ["AmazonProvidedDNS"],
    });

    new aws.ec2.VpcDhcpOptionsAssociation(`${stack}-vpc-dns-association`, {
        vpcId: vpc.vpcId,
        dhcpOptionsId: vpcDnsSettings.id,
    });

    // Security Groups
    const lbSg = new aws.ec2.SecurityGroup(`${stack}-lb-sg`, {
        vpcId: vpc.vpcId,
        ingress: [
            { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
        ],
    });

    const internalSg = new aws.ec2.SecurityGroup(`${stack}-internal-sg`, {
        vpcId: vpc.vpcId,
        ingress: [
            { protocol: "-1", fromPort: 0, toPort: 0, self: true },
            { protocol: "tcp", fromPort: 80, toPort: 80, securityGroups: [lbSg.id] },
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
        ],
        tags: { Name: "allow-internal-and-outbound" },
    });

    const region = cfg.require("AWS_REGION");

    // VPC Endpoints
    const vpcEndpoints = [
        new aws.ec2.VpcEndpoint(`${stack}-ssm-endpoint`, {
            vpcId: vpc.vpcId,
            serviceName: `com.amazonaws.${region}.ssm`,
            vpcEndpointType: "Interface",
            privateDnsEnabled: true,
            subnetIds: vpc.privateSubnetIds,
            securityGroupIds: [internalSg.id],
        }),
        new aws.ec2.VpcEndpoint(`${stack}-ssmmessages-endpoint`, {
            vpcId: vpc.vpcId,
            serviceName: `com.amazonaws.${region}.ssmmessages`,
            vpcEndpointType: "Interface",
            privateDnsEnabled: true,
            subnetIds: vpc.privateSubnetIds,
            securityGroupIds: [internalSg.id],
        }),
        new aws.ec2.VpcEndpoint(`${stack}-ec2messages-endpoint`, {
            vpcId: vpc.vpcId,
            serviceName: `com.amazonaws.${region}.ec2messages`,
            vpcEndpointType: "Interface",
            privateDnsEnabled: true,
            subnetIds: vpc.privateSubnetIds,
            securityGroupIds: [internalSg.id],
        }),
        new aws.ec2.VpcEndpoint(`${stack}-bedrock-endpoint`, {
            vpcId: vpc.vpcId,
            serviceName: `com.amazonaws.${region}.bedrock-runtime`,
            vpcEndpointType: "Interface",
            privateDnsEnabled: true,
            subnetIds: vpc.privateSubnetIds,
            securityGroupIds: [internalSg.id],
        }),
    ];
    return { vpc, internalSg, lbSg, vpcEndpoints };
}
