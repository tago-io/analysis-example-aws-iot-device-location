import { Data, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis } from "@tago-io/sdk";
import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";

async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  const awsRegion = context.environment.find((x) => x.key === "AWS_REGION")?.value as string;
  if (!awsRegion) {
    console.error("AWS_REGION not found in the environment variables");
    return;
  }
  const gnssSolverVariable = context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string
  const ipAddressVariable = context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string;

  let gnssValue;
  if (gnssSolverVariable) {
    gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string;
  }
 
  let ipAddress;
  if (ipAddressVariable) {
    ipAddress = (scope.find((x) => x.variable === ipAddressVariable)?.value as string)?.split(";");
  }

  let input;
  if (gnssValue) {
    input = {
      Gnss: {
        Payload: gnssValue,
      },
      Timestamp: new Date("TIMESTAMP"),
    };
  } else if (ipAddress) {
    input = {
      Ip: {
        IpAddress: ipAddress[0],
      },
      Timestamp: new Date("TIMESTAMP"),
    };
  } else {
    console.error("No Variables value found in the scope");
    return;
  }
  const client = new IoTWirelessClient({ region: awsRegion });
  const command = new GetPositionEstimateCommand(input);
  const response = await client.send(command).catch((error) => {
    console.error(error);
  });  
  if (response) { 
    const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
    if (estimatedLocation) {
      console.log(estimatedLocation);
      let lat = estimatedLocation.coordinates[1];
      let lng = estimatedLocation.coordinates[0];
      let acu = estimatedLocation.horizontalConfidenceLevel;
    }
  }
}

module.exports = new Analysis(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN });