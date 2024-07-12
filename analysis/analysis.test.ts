import { describe, expect, test, vi } from "vitest";
import { _createAWSPayload, _createDataForDevice, _getConfiguration, _getEstimatedLocation } from "./analysis";
import { Data, DataCreate, TagoContext } from "@tago-io/sdk/lib/types";

vi.mock("@tago-io/sdk", () => ({
  Resources: {
    devices: {
      sendDeviceData: vi.fn(),
    },
  },    
}));

describe("getEstimatedPosition", () => {
  test("should return ip_address payload", () => {
    const ip_address = ["127.0.0.1", "127.0.0.2"];
    const payload = _createAWSPayload("", ip_address[0], undefined);
    expect(payload.Ip?.IpAddress).toBe("127.0.0.1");
    expect(payload.WiFiAccessPoints).toBeUndefined();
    expect(payload.Gnss).toBeUndefined();
  });

  test("should return wifi_address payload", () => {
    const wifi_address = {
      "A0:EC:F9:1E:32:C1": -75,
      "A1:EC:F9:1E:32:C1": -56,
    };
    const payload = _createAWSPayload("", "", wifi_address);
    expect(payload.WiFiAccessPoints?.[0]?.MacAddress).toBe("A0:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[0]?.Rss).toBe(-75);
    expect(payload.WiFiAccessPoints?.[1]?.MacAddress).toBe("A1:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[1]?.Rss).toBe(-56);
    expect(payload.Gnss).toBeUndefined();
    expect(payload.Ip).toBeUndefined();
  });

  test("should return error if only wifi_address has sent", () => {
    const wifi_address = {
      "A0:EC:F9:1E:32:C1": -75,
    };
    try {
      _createAWSPayload("", "", wifi_address);
    } catch (error) {
      expect(error.message).toBe("Wifi Addresses must have at least 2 addresses");
    }
  });

  test("should return gnss solver payload", () => {
    const gnss_solver = "A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF";
    const payload = _createAWSPayload(gnss_solver, "", undefined);
    expect(payload.Gnss?.Payload).toBe("A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF");
    expect(payload.WiFiAccessPoints).toBeUndefined();
    expect(payload.Ip).toBeUndefined();
  });

  test("should return all payload", () => {
    const wifi_adress = {
      "A0:EC:F9:1E:32:C1": -75,
      "A1:EC:F9:1E:32:C1": -56,
    };
    const ip_address = ["127.0.0.1", "127.0.0.2"];
    const gnss_solver = "A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF";
    const payload = _createAWSPayload(gnss_solver, ip_address[0], wifi_adress);
    expect(payload.WiFiAccessPoints?.[0]?.MacAddress).toBe("A0:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[0]?.Rss).toBe(-75);
    expect(payload.WiFiAccessPoints?.[1]?.MacAddress).toBe("A1:EC:F9:1E:32:C1");
    expect(payload.WiFiAccessPoints?.[1]?.Rss).toBe(-56);
    expect(payload.Gnss?.Payload).toBe("A1B2C3D401020304112233445566778899AABBCCDDEEFF001234567890ABCDEF");
    expect(payload.Ip?.IpAddress).toBe("127.0.0.1");
  });

  test("should return error", () => {
    try {
      _createAWSPayload("", "", undefined);
    } catch (error) {
      expect(error.message).toBe("No data to create the payload");
    }
  });

  test("should return the data to send to device", () => {
    const scope: Data = {
      created_at: new Date("2024-07-01T18:06:30.805Z"),
      device: "123abc123",
      group: "abc123abc",
      id: "qwe123qew",
      metadata: { ip_list: ["127.0.0.1"] },
      time: new Date("2024-07-01T18:06:30.805Z"),
      value: "127.0.0.1",
      variable: "ip_address",
    };
    const desireableAccuracy = "10";
    const estimatedLocation = {
      coordinates: [10, 20],
      properties: {
        horizontalConfidenceLevel: 10,
        verticalConfidenceLevel: 12,
      },
    };
    const result: DataCreate = _createDataForDevice(scope, desireableAccuracy, estimatedLocation);
    expect(result.group).toBe(scope.group);
    expect(result.time).toBe(scope.time);
    expect(result.variable).toBe("estimated_location");
    expect(result.value).toBe("20;10");
    expect(result.metadata?.horizontalAccuracy).toBe(10);
    expect(result.metadata?.verticalAccuracy).toBe(12);
    expect(result.metadata?.color).toBe("green");
    expect.objectContaining({ result: { location: { lat: 20, lng: 10 } } });
  });

  test("should return configurations", () => {
    const context: TagoContext = {
      environment: [
        {
          id: "1234567890",
          key: "AWS_ACCESSKEYID",
          value: "12345abc",
        },
        {
          id: "09876543211",
          key: "AWS_SECRETACCESSKEY",
          value: "54321asd",
        },
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "0.50"
        },
        {
          key: "AWS_REGION",
          value: "abcd123"
        }
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    const configuration = _getConfiguration(context);
    expect(configuration.awsAccessKeyId).toBe("12345abc");
    expect(configuration.awsSecretAccessKey).toBe("54321asd");
    expect(configuration.desireableAccuracyPercent).toBe("0.50");
    expect(configuration.awsRegion).toBe("abcd123");
  });

  test("should return missing awsAccessKeyId", () => {
    const context: TagoContext = {
      environment: [
        {
          id: "09876543211",
          key: "AWS_SECRETACCESSKEY",
          value: "54321asd",
        },
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "0.50"
        },
        {
          key: "AWS_REGION",
          value: "abcd123"
        }
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    try {
      _getConfiguration(context);
    } catch (error) {
      expect(error.message).toBe("AWS_ACCESSKEYID not found in the environment variables");
    }
  });

  test("should return missing awsSecretAccessKey", () => {
    const context: TagoContext = {
      environment: [
        {
          id: "1234567890",
          key: "AWS_ACCESSKEYID",
          value: "12345abc",
        },
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "0.50"
        },
        {
          key: "AWS_REGION",
          value: "abcd123"
        }
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    try {
      _getConfiguration(context);
    } catch (error) {
      expect(error.message).toBe("AWS_SECRETACCESSKEY not found in the environment variables");
    }
  });

  test("should return missing awsRegion", () => {
    const context: TagoContext = {
      environment: [
        {
          id: "1234567890",
          key: "AWS_ACCESSKEYID",
          value: "12345abc",
        },
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "0.50"
        },
        {
          id: "09876543211",
          key: "AWS_SECRETACCESSKEY",
          value: "54321asd",
        },
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    try {
      _getConfiguration(context);
    } catch (error) {
      expect(error.message).toBe("AWS_REGION not found in the environment variables");
    }
  });

  test("should return desireableAccuracyPercent must be numeric", () => {
    const context: TagoContext = {
      environment: [
        {
          id: "1234567890",
          key: "AWS_ACCESSKEYID",
          value: "12345abc",
        },
        {
          id: "09876543211",
          key: "AWS_SECRETACCESSKEY",
          value: "54321asd",
        },
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "teste"
        },
        {
          key: "AWS_REGION",
          value: "abcd123"
        },
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    try {
      _getConfiguration(context);
    } catch (error) {
      expect(error.message).toBe("DESIREABLE_ACCURACY_PERCENT must be a numeric value");
    }
  });

  test("should return missing awsAccessKeyId, awsSecretAccessKey and awsRegion", () => {
    const context: TagoContext = {
      environment: [
        {
          key: "DESIREABLE_ACCURACY_PERCENT",
          value: "0.50"
        },
      ],
      token: "",
      analysis_id: "",
      log: vi.fn(),
    };
    try {
      _getConfiguration(context);
    } catch (error) {
      expect(error.message).toBe("AWS_REGION AWS_ACCESSKEYID AWS_SECRETACCESSKEY not found in the environment variables");
    }
  });

  test("should return estimated location data", () => {
    const response = {
      GeoJsonPayload: {
        transformToString: () => JSON.stringify({
          coordinates: [10, 20],
          type: "Point",
          properties: {
            horizontalConfidenceLevel: 10,
            verticalConfidenceLevel: 12,
          },
        }),
      },
    };
    const estimatedLocation = _getEstimatedLocation(response);
    expect(estimatedLocation.coordinates).toEqual([10, 20]);
    expect(estimatedLocation.properties.horizontalConfidenceLevel).toBe(10);
    expect(estimatedLocation.properties.verticalConfidenceLevel).toBe(12);    
  });

  test("should return error no response from AWS", () => {
    try {
      _getEstimatedLocation(undefined);
    } catch (error) {
      expect(error.message).toBe("No response from AWS");
    }
  });

  test("should return error no estimated location found", () => {
    const response = {
      GeoJsonPayload: {
        transformToString: () => JSON.stringify({}),
      },
    };
    try {
      _getEstimatedLocation(response);
    } catch (error) {
      expect(error.message).toBe("No estimated location found");
    }
  });
});
