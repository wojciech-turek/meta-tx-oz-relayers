"use client";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

import { RelayerTokenAbi } from "@/abis/RelayerToken";
import { TrustedForwarderAbi } from "@/abis/TrustedForwarder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ethers } from "ethers";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface NFT {
  id: number;
  image: string;
  contractAddress: string;
  tokenId: string;
  mintTxHash: string;
}

export default function NFTGallery() {
  const [account, setAccount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const BASE_SEPOLIA_CHAIN_ID = "0x14A34";
  const BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";
  const baseSepoliaNetwork = {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    chainName: "Base Sepolia",
    rpcUrls: [BASE_SEPOLIA_RPC_URL],
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18,
    },
    blockExplorerUrls: ["https://sepolia-explorer.base.org"],
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        // Request account access
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        setErrorMessage("");

        // Add Base Sepolia network  // Check if we're already on Base Sepolia
        const { chainId } = await provider.getNetwork();
        if (Number(chainId) !== parseInt(BASE_SEPOLIA_CHAIN_ID, 16)) {
          await switchToBaseSepolia();
        }
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to connect wallet");
        }
      }
    } else {
      setErrorMessage("MetaMask is not installed");
    }
  };

  // Function to switch to or add Base Sepolia network
  const switchToBaseSepolia = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (switchError: any) {
      // If the network is not added, add it first
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [baseSepoliaNetwork],
          });
        } catch (error) {
          console.error(error);
          setErrorMessage("Failed to add Base Sepolia network");
        }
      } else {
        setErrorMessage("Failed to switch to Base Sepolia network");
      }
    }
  };

  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isMinting, setIsMinting] = useState(false);

  const mintNFT = useCallback(async () => {
    setIsMinting(true);
    try {
      const userProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await userProvider.getSigner();
      const tokenContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        RelayerTokenAbi,
        userProvider
      );
      const forwarderContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_FORWARDER_ADDRESS!,
        TrustedForwarderAbi,
        userProvider
      );
      const mintData = tokenContract.interface.encodeFunctionData("safeMint", [
        signer.address,
      ]);

      // Get the nonce for the signer
      const nonce = await forwarderContract.nonces(signer.address);

      // Current timestamp plus 1 hour (in seconds)
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Prepare the forward request with string values
      const forwardRequest = {
        from: signer.address,
        to: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        value: "0",
        gas: "1000000", // Convert to string
        nonce: nonce.toString(), // Convert BigInt to string
        deadline: deadline.toString(), // Convert to string
        data: mintData,
      };

      // Prepare the domain separator
      const domain = {
        name: "MyForwarder",
        version: "1",
        chainId: (await userProvider.getNetwork()).chainId,
        verifyingContract: process.env.NEXT_PUBLIC_FORWARDER_ADDRESS!,
      };

      // Define the types
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      };

      // Sign the typed data
      const signature = await signer.signTypedData(
        domain,
        types,
        forwardRequest
      );

      // Create the complete forward request data structure
      const forwardRequestData = {
        ...forwardRequest,
        signature: signature,
      };

      // Verify the request before sending
      const isValid = await forwarderContract.verify(forwardRequestData);

      if (!isValid) {
        throw new Error("Forward request verification failed");
      }

      console.log("Request verified successfully!");
      console.log({ forwardRequest, signature });

      // After verification succeeds, prepare the data for the API
      const encodedExecute = forwarderContract.interface.encodeFunctionData(
        "execute",
        [forwardRequestData]
      );

      // Call our relay API endpoint
      const response = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ encodedExecute }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to relay transaction");
      }

      const result = await response.json();
      console.log("Transaction sent:", result.transactionHash);

      // use ethers to wait and listen to the tx events
      const tx = await userProvider.waitForTransaction(result.transactionHash);
      console.log("Transaction confirmed:", tx);

      // extract the tokenId from the tx logs
      const tokenId = tx?.logs[0].topics[3];

      if (!tokenId) {
        throw new Error("Failed to extract token ID from transaction logs");
      }

      const tokenIdNumber = parseInt(tokenId, 16);
      const tokenURI = await tokenContract.tokenURI(tokenId);

      setNfts([
        ...nfts,
        {
          id: tokenIdNumber,
          tokenId: tokenIdNumber.toString(),
          contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
          image: tokenURI,
          mintTxHash: result.transactionHash,
        },
      ]);
      console.log("Token ID:", tokenId);
    } catch (error) {
      console.error("Error minting NFT:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Minting failed"
      );
    } finally {
      setIsMinting(false);
    }
  }, []);

  const handleButtonClick = () => {
    if (account) {
      mintNFT();
    } else {
      connectWallet();
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-8">
          Gassless NFT Minting PoC using OZ Relayers
        </h1>
        <div className="flex justify-center mb-8">
          <Button
            onClick={handleButtonClick}
            disabled={isMinting}
            className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-bold py-2 px-4 rounded-none shadow-lg transition duration-200 ease-in-out"
          >
            {isMinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting...
              </>
            ) : account ? (
              "Mint NFT without paying gas fee"
            ) : (
              "Connect Wallet"
            )}
          </Button>
          {errorMessage && (
            <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {nfts.map((nft) => (
            <Card
              key={nft.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none overflow-hidden transition duration-200 ease-in-out hover:shadow-lg"
            >
              <CardContent className="p-4">
                <img
                  src={nft.image}
                  alt={`NFT ${nft.id}`}
                  className="w-full h-64 object-cover mb-4"
                />
                <div>
                  <p
                    className="text-sm font-medium truncate"
                    title={nft.contractAddress}
                  >
                    Contract: {nft.contractAddress}
                  </p>
                  <p
                    className="text-sm font-medium truncate"
                    title={nft.tokenId}
                  >
                    Token ID: {nft.tokenId}
                  </p>
                  <p className="text-sm font-medium">
                    <a
                      href={`https://sepolia.basescan.org/tx/${nft.mintTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 font-bold hover:underline truncate block"
                      title="View transaction on BaseScan"
                    >
                      Mint Tx Link
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
