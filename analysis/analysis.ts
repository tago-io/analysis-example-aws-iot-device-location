import { Data, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis, Resources } from "@tago-io/sdk";
import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";

async function sendEstimatedLocationData(estimatedLocation: any, scope: Data, desireableAccuracy: string) {
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
  const desireableAccuracy = context.environment.find((x) => x.key === "DESIREABLE_ACCURACY")?.value as string || "0";
  const gnssSolverVariable = context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string
  const ipAddressVariable = context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string;
  const wifiAdressesVariable = context.environment.find((x) => x.key === "WIFI_ADDRESSES_VARIABLE")?.value as string;

  let gnssValue;
  if (gnssSolverVariable) {
    gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string;
  }
 
  let ipAddress;
  if (ipAddressVariable) {
    ipAddress = (scope.find((x) => x.variable === ipAddressVariable)?.value as string)?.split(";");
  }

  let wifiAddresses;
  if (wifiAdressesVariable) {
    wifiAddresses = scope.find((x) => x.variable === wifiAdressesVariable)?.metadata; 
  };

  let input;
  if (gnssValue) {
    input = {
      Gnss: {
        Payload: gnssValue,
      },
      Timestamp: new Date(),
    };
  } else if (ipAddress) {
    input = {
      Ip: {
        IpAddress: ipAddress[0],
      },
      Timestamp: new Date(),
    };
  } else if (wifiAddresses) {
    input = {
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
      Timestamp: new Date(),
    };
  } else {
    console.error("No Variables value found in the scope");
    return;
  }
  const client = new IoTWirelessClient({ credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey, sessionToken: awsSessionToken }, region: awsRegion });
  const command = new GetPositionEstimateCommand(input);
  const response = await client.send(command).catch((error) => {
    console.error(error.message);
    return;
  });  
  if (response) { 
    const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
    if (estimatedLocation) {
      await sendEstimatedLocationData(estimatedLocation, scope[0], desireableAccuracy);
    }
  }
}

module.exports = new Analysis(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN });
