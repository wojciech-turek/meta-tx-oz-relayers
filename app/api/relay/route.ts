import { Defender } from "@openzeppelin/defender-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { encodedExecute } = await request.json();

    // Validate the incoming data
    if (!encodedExecute) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get the relayer instance
    const defender = new Defender({
      relayerApiKey: process.env.RELAYER_API_KEY!,
      relayerApiSecret: process.env.RELAYER_SECRET_KEY!,
    });

    // Send the transaction through the relayer
    const tx = await defender.relaySigner.sendTransaction({
      to: process.env.NEXT_PUBLIC_FORWARDER_ADDRESS!,
      speed: "fast",
      data: encodedExecute,
      gasLimit: 500_000,
    });

    return NextResponse.json({
      success: true,
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Relay API Error:", error);
    return NextResponse.json(
      { error: "Failed to relay transaction" },
      { status: 500 }
    );
  }
}
