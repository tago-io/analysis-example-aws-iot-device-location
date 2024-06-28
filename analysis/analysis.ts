import { Data, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis, Resources } from "@tago-io/sdk";
import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";

function createAWSPayload(gnssValue: string, ipAddress: string[], wifiAddresses) {
  let payload = {};
  if (gnssValue) {
    Object.assign(payload, { 
      Gnss: {
        Payload: gnssValue,
      } 
    });
  }

  if (ipAddress) {
    Object.assign(payload, { 
      Ip: {
        IpAddress: ipAddress[0],
      } 
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
  Object.assign(payload, { Timestamp: new Date() });
  return payload;
}

async function sendEstimatedLocationData(scope: Data, desireableAccuracy: string, estimatedLocation) {
  let lat = estimatedLocation.coordinates[1];
  let lng = estimatedLocation.coordinates[0];
  let horizontalAccuracy = estimatedLocation.properties.horizontalConfidenceLevel;
  let verticalAccuracy = estimatedLocation.properties.verticalConfidenceLevel;
  let accuracy = ((horizontalAccuracy >= parseInt(desireableAccuracy) || verticalAccuracy >= parseInt(desireableAccuracy)));
  await Resources.devices.sendDeviceData(scope.device, {
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
  });
  console.log("Data sent to the device");
}

async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  console.log("Starting Analysis");
  const awsAccessKeyId = context.environment.find((x) => x.key === "AWS_ACCESSKEYID")?.value as string;
  const awsSecretAccessKey = context.environment.find((x) => x.key === "AWS_SECRETACCESSKEY")?.value as string;
  const awsSessionToken = context.environment.find((x) => x.key === "AWS_SESSIONTOKEN")?.value as string;
  const awsRegion = context.environment.find((x) => x.key === "AWS_REGION")?.value as string;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !awsSessionToken) {
    console.error("AWS Credentials or Region not found in the environment variables");
    return;
  }
  const desireableAccuracyPercent = context.environment.find((x) => x.key === "DESIREABLE_ACCURACY_PERCENT")?.value as string || "0";
  const gnssSolverVariable = context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string || "gnss_solver";
  const ipAddressVariable = context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string || "ip_addresses";
  const wifiAdressesVariable = context.environment.find((x) => x.key === "WIFI_ADDRESSES_VARIABLE")?.value as string || "wifi_addresses";
  let gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string;
  let ipAddress = (scope.find((x) => x.variable === ipAddressVariable)?.value as string)?.split(";");
  let wifiAddresses = scope.find((x) => x.variable === wifiAdressesVariable)?.metadata; 

  let payload = createAWSPayload(gnssValue, ipAddress, wifiAddresses);
  if (!payload) {
    console.error("No Variables value found in the scope");
    return;
  }

  const client = new IoTWirelessClient({ credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey, sessionToken: awsSessionToken }, region: awsRegion });
  const command = new GetPositionEstimateCommand(payload);
  const response = await client.send(command).catch((error) => {
    console.error(error.message);
    return;
  });  
  if (response) { 
    const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
    if (estimatedLocation) {
      await sendEstimatedLocationData(scope[0], desireableAccuracyPercent, estimatedLocation);
    }
  }
  console.log("Analysis Finished");
}

module.exports = new Analysis(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN });
