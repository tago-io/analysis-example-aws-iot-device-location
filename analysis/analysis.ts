import { Data, DataCreate, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis, Resources } from "@tago-io/sdk";
import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";

interface PayloadReturn {
  Gnss?: {
    Payload: string;
  };
  Ip?: {
    IpAddress: string;
  };
  WiFiAccessPoints?: {
    MacAddress: string;
    Rss: number;
  }[];
  Timestamp: Date;
}

function _createAWSPayload(gnssValue: string, ipAddress: string[], wifiAddresses): PayloadReturn {
  let payload: PayloadReturn = { Timestamp: new Date() };
  if (gnssValue) {
    Object.assign(payload, {
      Gnss: {
        Payload: gnssValue,
      },
    });
  }

  if (ipAddress.length > 0) {
    Object.assign(payload, {
      Ip: {
        IpAddress: ipAddress[0],
      },
    });
  }

  if (wifiAddresses) {
    Object.assign(payload, {
      WiFiAccessPoints: [
        {
          MacAddress: Object.keys(wifiAddresses)[0] as string,
          Rss: Object.values(wifiAddresses)[0] as number,
        },
        {
          MacAddress: Object.keys(wifiAddresses)[1] as string,
          Rss: Object.values(wifiAddresses)[1] as number,
        },
      ],
    });
  }
  return payload;
}

function _createDataForDevice(scope: Data, desireableAccuracy: string, estimatedLocation): DataCreate {
  let lat = estimatedLocation.coordinates[1];
  let lng = estimatedLocation.coordinates[0];
  let horizontalAccuracy = estimatedLocation.properties.horizontalConfidenceLevel;
  let verticalAccuracy = estimatedLocation.properties.verticalConfidenceLevel;
  let accuracy = horizontalAccuracy >= parseInt(desireableAccuracy) || verticalAccuracy >= parseInt(desireableAccuracy);
  let dataReturn: DataCreate = {
    variable: "estimated_location",
    value: accuracy ? "accurate" : "not accurate",
    location: {
      lat,
      lng,
    },
    metadata: {
      horizontalAccuracy: horizontalAccuracy,
      verticalAccuracy: verticalAccuracy,
      color: accuracy ? "green" : "red",
    },
    group: scope.group,
    time: scope.time,
  };
  return dataReturn;
}

async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  console.log("Starting Analysis");
  const awsAccessKeyId = context.environment.find((x) => x.key === "AWS_ACCESSKEYID")?.value as string;
  const awsSecretAccessKey = context.environment.find((x) => x.key === "AWS_SECRETACCESSKEY")?.value as string;
  const awsRegion = context.environment.find((x) => x.key === "AWS_REGION")?.value as string;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
    console.error("AWS Credentials or Region not found in the environment variables");
    return;
  }
  const desireableAccuracyPercent = (context.environment.find((x) => x.key === "DESIREABLE_ACCURACY_PERCENT")?.value as string) || "0";
  const gnssSolverVariable = (context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string) || "gnss_solver";
  const ipAddressVariable = (context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string) || "ip_addresses";
  const wifiAdressesVariable = (context.environment.find((x) => x.key === "WIFI_ADDRESSES_VARIABLE")?.value as string) || "wifi_addresses";
  let gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string;
  let ipAddress = (scope.find((x) => x.variable === ipAddressVariable)?.value as string)?.split(";");
  let wifiAddresses = scope.find((x) => x.variable === wifiAdressesVariable)?.metadata;
  if (!ipAddress && !wifiAddresses && !gnssValue) {
    console.error("No Variables value found in the scope");
    return;
  }

  let payload = _createAWSPayload(gnssValue, ipAddress, wifiAddresses);
  const client = new IoTWirelessClient({ credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey }, region: awsRegion });
  const command = new GetPositionEstimateCommand(payload);
  const response = await client.send(command).catch((error) => {
    console.error(error.message);
    return;
  });
  if (response) {
    const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
    if (estimatedLocation) {
      await Resources.devices.sendDeviceData(scope[0].device, _createDataForDevice(scope[0], desireableAccuracyPercent, estimatedLocation));
    }
  }
  console.log("Analysis Finished");
}

if (process.env.NODE_ENV !== "test") {
  module.exports = new Analysis(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN });
}

export { _createAWSPayload, _createDataForDevice };
