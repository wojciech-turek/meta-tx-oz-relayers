import { Contract } from "ethers";

interface TypeData {
  types: {
    EIP712Domain: { name: string; type: string }[];
    ForwardRequest: { name: string; type: string }[];
  };
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  primaryType: string;
  message: Record<string, unknown>;
}

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

const ForwardRequest = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "gas", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "data", type: "bytes" },
];

// function getMetaTxTypeData(
//   chainId: number,
//   verifyingContract: string
// ): TypeData {
//   return {
//     types: {
//       EIP712Domain,
//       ForwardRequest,
//     },
//     domain: {
//       name: "ERC2771Forwarder",
//       version: "1",
//       chainId,
//       verifyingContract,
//     },
//     primaryType: "ForwardRequest",
//     message: {},
//   };
// }

// async function signTypedData(
//   signer: ethers.Signer | string,
//   from: string,
//   data: TypeData
// ): Promise<string> {
//   if (typeof signer === "string") {
//     const privateKey = Buffer.from(signer.replace(/^0x/, ""), "hex");
//     return ethSigUtil.signTypedMessage(privateKey, { data });
//   }

//   const isHardhat = data.domain.chainId === 31337;
//   const [method, argData] = isHardhat
//     ? ["eth_signTypedData", data]
//     : ["eth_signTypedData_v4", JSON.stringify(data)];

//   return await (signer as JsonRpcSigner).signTypedData();
// }

async function buildRequest(
  forwarder: Contract,
  input: Partial<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const nonce = await forwarder.getNonce(input.from as string);

  console.log(nonce);
  return { value: 0, gas: 1e6, nonce, ...input };
}

// async function buildTypedData(
//   forwarder: Contract,
//   request: Record<string, unknown>
// ): Promise<TypeData> {
//   const chainId = await forwarder.provider.getNetwork().then((n) => n.chainId);
//   const typeData = getMetaTxTypeData(chainId, forwarder.address);
//   return { ...typeData, message: request };
// }

// async function signMetaTxRequest(
//   signer: ethers.Signer,
//   forwarder: Contract,
//   input: Record<string, unknown>
// ) {
//   const request = await buildRequest(forwarder, input);
// const toSign = await buildTypedData(forwarder, request);
// const signature = await signTypedData(signer, input.from as string, toSign);
// return { signature, request };
// }

export { buildRequest };
