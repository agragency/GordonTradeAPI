import express from "express";
import fetch from "node-fetch";
import bs58 from "bs58";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const connection = new Connection("https://api.mainnet-beta.solana.com");

const secretKey = bs58.decode(process.env.PHANTOM_PRIVATE_KEY);
const keypair = Keypair.fromSecretKey(secretKey);

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

app.post("/trade", async (req, res) => {
  try {
    const { inputMint, outputMint, amount } = req.body;

    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (!quoteData || !quoteData.data || quoteData.data.length === 0) {
      return res.status(400).json({ error: "No route found" });
    }

    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: quoteData.data[0],
        userPublicKey: keypair.publicKey.toString(),
      }),
    });

    const { swapTransaction } = await swapResponse.json();

    const transactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([keypair]);

    const txid = await connection.sendTransaction(transaction);

    res.json({ success: true, txid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Trade failed", details: err.message });
  }
});

app.listen(3000, () => {
  console.log("🚀 Gordon Trade API running on port 3000");
});
