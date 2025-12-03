import fetch from "cross-fetch";

export interface ECKey {
  kty: "EC";
  crv: string;
  x: string;
  y: string;
}

export async function getCertChain(
  leafJwt: ECKey,
  backendUrl: string,
): Promise<string> {
  let response = await fetch(backendUrl + "/cert-chain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(leafJwt),
  });

  if (!response.ok) {
    throw "failed to retrieve the certificate chain:" + (await response.text());
  }

  return await response.text();
}
