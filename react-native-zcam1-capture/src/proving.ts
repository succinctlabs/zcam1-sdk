import { Attestation, Settings } from "./index";

export async function generateProof(
  attestation: Attestation, // b64
  assertion: string, // b64
  keyId: string, // b64
  dataHash: string, // b64
  settings: Settings,
) {
  const requestId = await requestProof(
    attestation.data,
    assertion,
    keyId,
    dataHash,
    attestation.challenge,
    settings,
  );

  console.log(`Requested proof: ${requestId}`);

  let proof = await getProof(requestId, settings);

  return proof;
}

async function requestProof(
  attestation: string, // b64
  assertion: string, // b64
  keyId: string, // b64
  dataHash: string, // b64
  challenge: string,
  settings: Settings,
): Promise<string> {
  let response = await fetch(settings.backendUrl + "/ios/request-proof", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attestation,
      assertion,
      keyId,
      dataHash,
      appId: settings.appId,
      challenge,
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
