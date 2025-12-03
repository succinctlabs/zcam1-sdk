import type { Settings } from ".";
import { DeviceBindings } from "react-native-zcam1-c2pa";

export async function generateProof(
  deviceBindings: DeviceBindings,
  dataHash: string, // b64
  settings: Settings,
): Promise<Uint8Array> {
  const requestId = await requestProof(deviceBindings, dataHash, settings);

  console.log(`Requested proof: ${requestId}`);

  let proof = await getProof(requestId, settings);

  return proof;
}

export async function getVkHash(settings: Settings): Promise<String> {
  let response = await fetch(settings.backendUrl + `/ios/vk`);

  const vkHash = await response.text();

  return vkHash;
}

async function requestProof(
  deviceBindings: DeviceBindings,
  dataHash: string, // b64
  settings: Settings,
): Promise<string> {
  let response = await fetch(settings.backendUrl + "/ios/request-proof", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attestation: deviceBindings.attestation,
      assertion: deviceBindings.assertion,
      keyId: deviceBindings.deviceKeyId,
      dataHash,
      appId: deviceBindings.appId,
      challenge: deviceBindings.challenge,
      appAttestProduction: settings.production,
    }),
  });

  if (!response.ok) {
    throw "failed to request a proof:" + (await response.text());
  }

  return await response.text();
}

async function getProof(
  requestId: string,
  settings: Settings,
): Promise<Uint8Array> {
  while (true) {
    let response = await fetch(settings.backendUrl + `/ios/proof/${requestId}`);

    if (response.status === 200) {
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } else if (response.status !== 202) {
      throw await response.text();
    }

    console.log(`Waiting for proof: ${requestId}`);
    await sleep(3000);
  }
}

async function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
