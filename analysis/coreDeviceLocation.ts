import { Data, TagoContext } from "@tago-io/sdk/lib/types";
import { Analysis, Resources } from "@tago-io/sdk";

async function getEstimatedDeviceLocation(context: TagoContext, scope: Data[]) {
  console.log(context);
  console.log(scope);
}

module.exports = new Analysis(getEstimatedDeviceLocation);