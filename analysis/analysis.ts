import { GetPositionEstimateCommand, IoTWirelessClient } from "@aws-sdk/client-iot-wireless";
import { Analysis, Resources } from "@tago-io/sdk";
import { Data, DataCreate, TagoContext } from "@tago-io/sdk/lib/types";

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

interface EstimatedConfiguration {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  desireableAccuracyPercent: string;  
}

/**
 * Get estimated location to send to the device from AWS response.
 */
function _getEstimatedLocation(response) {
  if (!response) {
    throw new Error("No response from AWS");
  }
  const estimatedLocation = JSON.parse(response.GeoJsonPayload?.transformToString() ?? "");
  if (!estimatedLocation) {
    throw new Error("No estimated location found");
  }
  return estimatedLocation;
}

/**
 * Get configurations and secrets for AWS request and the desireable accuracy percent.
 */
function _getConfiguration(context: TagoContext): EstimatedConfiguration {
  const configuration: EstimatedConfiguration = {
    awsAccessKeyId: context.environment.find((x) => x.key === "AWS_ACCESSKEYID")?.value as string,
    awsSecretAccessKey: context.environment.find((x) => x.key === "AWS_SECRETACCESSKEY")?.value as string,
    awsRegion: context.environment.find((x) => x.key === "AWS_REGION")?.value as string,
    desireableAccuracyPercent: (context.environment.find((x) => x.key === "DESIREABLE_ACCURACY_PERCENT")?.value as string) || "0",
  }
  if (!configuration.awsRegion || !configuration.awsAccessKeyId || !configuration.awsSecretAccessKey) {
    let missing = "";
    if (!configuration.awsRegion) {
      missing += "AWS_REGION ";
    }
    if (!configuration.awsAccessKeyId) {
      missing += "AWS_ACCESSKEYID ";
    }
    if (!configuration.awsSecretAccessKey) {
      missing += "AWS_SECRETACCESSKEY ";
    }
    throw new Error(missing + "not found in the environment variables");
  }
  
  if (!parseFloat(configuration.desireableAccuracyPercent) && parseFloat(configuration.desireableAccuracyPercent) !== 0) {
    throw new Error("DESIREABLE_ACCURACY_PERCENT must be a numeric value");
  }
  return configuration;
}

/**
 * Creates a data object to send to GetPositionEstimateCommand.
 */
function _createAWSPayload(gnssValue: string, ipAddress: string, wifiAddresses): PayloadReturn {
  if (!gnssValue && !ipAddress && !wifiAddresses) {
    throw new Error("No data to create the payload");
  }

  let payload: PayloadReturn = { Timestamp: new Date() };
  if (gnssValue) {
    payload = {... payload, Gnss: { Payload: gnssValue } };
  }

  if (ipAddress) {
    payload = {... payload, Ip: { IpAddress: ipAddress } };
  }

  if (wifiAddresses) {
    if (Object.keys(wifiAddresses).length < 2) {
      throw new Error("Wifi Addresses must have at least 2 addresses");
    }
    payload = {... payload, WiFiAccessPoints: [
      {
        MacAddress: Object.keys(wifiAddresses)[0] as string,
        Rss: Object.values(wifiAddresses)[0] as number,
      },
      {
        MacAddress: Object.keys(wifiAddresses)[1] as string,
        Rss: Object.values(wifiAddresses)[1] as number,
      },
    ]};
  }
  return payload;
}

/**
 * Creates a data object for the device based on the estimated location's accuracy.
 */
function _createDataForDevice(scope: Data, desireableAccuracy: string, estimatedLocation): DataCreate {
  let lat = estimatedLocation.coordinates[1];
  let lng = estimatedLocation.coordinates[0];
  let horizontalAccuracy = estimatedLocation.properties.horizontalConfidenceLevel;
  let verticalAccuracy = estimatedLocation.properties.verticalConfidenceLevel;
  let accuracy = horizontalAccuracy >= parseFloat(desireableAccuracy) || verticalAccuracy >= parseFloat(desireableAccuracy);
  let dataReturn: DataCreate = {
    variable: "estimated_location",
    value: lat + ";" + lng,
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

/**
 * Estimates the device location using AWS IoT Wireless services based on GNSS, IP address, and WiFi addresses data.
 * 
 * This function retrieves AWS credentials and region information from the environment variables,
 * constructs a payload for the AWS IoT Wireless GetPositionEstimateCommand, and sends the command
 * to estimate the device's location. If successful, it sends the estimated location data back to the device.
 */
async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  console.log("Starting Analysis");
  let configuration;
  try {
    configuration = _getConfiguration(context);
  } catch (error) {
    console.error(error.message);
    return;
  }

  // Get the variables from the environment
  //Name of the variable to get GNSS Payload value
  const gnssSolverVariable = (context.environment.find((x) => x.key === "GNSS_SOLVER_VARIABLE")?.value as string) || "gnss_solver"; 
  
  //Name of the variable to get IP Address value
  const ipAddressVariable = (context.environment.find((x) => x.key === "IP_ADDRESS_VARIABLE")?.value as string) || "ip_addresses";
  
  //Name of the variable to get Wifi Address value
  const wifiAdressesVariable = (context.environment.find((x) => x.key === "WIFI_ADDRESSES_VARIABLE")?.value as string) || "wifi_addresses"; 
  
  //Get the GNSS Payload value from scope
  const gnssValue = scope.find((x) => x.variable === gnssSolverVariable)?.value as string; 

  //Get the IP Address value from scope. Must be a IPv4 address (127.0.0.1)
  const ipAddress = (scope.find((x) => x.variable === ipAddressVariable)?.value as string)?.split(";");
  
  //Get the Wifi Addresses value from scope. Must be an object with the MAC Address as key and RSS as value ({"A0:EC:F9:1E:32:C1": -75, "A1:EC:F9:1E:32:C1": -56})
  const wifiAddresses = scope.find((x) => x.variable === wifiAdressesVariable)?.metadata; 

  try {
    const payload = _createAWSPayload(gnssValue, ipAddress[0], wifiAddresses);
    const client = new IoTWirelessClient({ credentials: { accessKeyId: configuration.awsAccessKeyId, secretAccessKey: configuration.awsSecretAccessKey }, region: configuration.awsRegion });
    const command = new GetPositionEstimateCommand(payload);
    const response = await client.send(command);
    const estimatedLocation = _getEstimatedLocation(response);
    await Resources.devices.sendDeviceData(scope[0].device, _createDataForDevice(scope[0], configuration.desireableAccuracyPercent, estimatedLocation));
    console.log("Analysis Finished");
  } catch (error) {
    console.error(error.message);
  }
}

if (process.env.NODE_ENV !== "test") {
  Analysis.use(getEstimatedDeviceLocation, { token: process.env.T_ANALYSIS_TOKEN || "Your-Analysis-Token" });
}

export { _createAWSPayload, _createDataForDevice, _getConfiguration, _getEstimatedLocation };
