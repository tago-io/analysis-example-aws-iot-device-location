import { Data, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis } from "@tago-io/sdk";
import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";

async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  // console.log(context);
  // console.log(scope);
  const awsRegion = context.environment.find((x) => x.key === "AWS_REGION")?.value as string;
  const gnssSolverVariable = context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string
  const ipAddressVariable = context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string;

  let gnssValue;
  if (gnssSolverVariable) {
    gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string;
  }
 
  let ipAddress;
  if (ipAddressVariable) {
    ipAddress = scope.find((x) => x.variable === ipAddressVariable)?.value as string;
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
        IpAddress: ipAddress,
      },
      Timestamp: new Date("TIMESTAMP"),
    };
  }
  const client = new IoTWirelessClient({ region: awsRegion });
  const command = new GetPositionEstimateCommand(input);
  const response = await client.send(command);  
  const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
  if (estimatedLocation) {
    console.log(estimatedLocation);
    let latitude = estimatedLocation.coordinates[1];
    let longitude = estimatedLocation.coordinates[0];
    let accuracy = estimatedLocation.horizontalConfidenceLevel;
  }
}

module.exports = new Analysis(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN });