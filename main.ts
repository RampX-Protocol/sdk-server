import {
	ChainName,
	createSwapFromSolanaInstructions,
	fetchQuote,
	getSwapFromEvmTxPayload,
} from "@mayanfinance/swap-sdk";
import { Connection } from "@solana/web3.js";
import express, { Request, Response } from "express";
const app = express();
const port = 3000;

const chainNames = [
  "solana",
  "ethereum",
  "bsc",
  "polygon",
  "avalanche",
  "arbitrum",
  "optimism",
  "base",
];

const chainNameToId: any = {
  solana: 0,
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  avalanche: 43114,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
};

app.get("/solana", async (req: Request, res: Response) => {
  try {
    const amountIn = Number(req.query.amountIn);
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = Number(req.query.slippageBps);
    const gasDrop = Number(req.query.gasDrop);
    const referrerBps = Number(req.query.referrerBps);
    const evmReferrer = req.query.evmReferrer!.toString();
    const solanaReferrer = req.query.solanaReferrer!.toString();
	const relayerAddress = req.query.relayerAddress!.toString();
    if (!chainNames.includes(fromChain) || !chainNames.includes(toChain)) {
      res.status(406).send("Invalid chain name");
      return;
    }
    const quotes = await fetchQuote(
      {
        amount: Number(amountIn),
        fromToken: fromToken!.toString(),
        toToken: toToken!.toString(),
        fromChain: fromChain as ChainName,
        toChain: toChain as ChainName,
        slippageBps: slippageBps,
        gasDrop: gasDrop,
        referrerBps: referrerBps,
        referrer: fromChain === "solana" ? solanaReferrer : evmReferrer,
      },
      {
        gasless: false,
        mctp: false,
        onlyDirect: false,
        swift: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!swiftQuote) {
      res.status(406).send("No SWIFT quote available");
    }

	swiftQuote!.relayer = relayerAddress;

    const swapperWallet = req.query.swapperAddress!.toString();
    const destAddress = req.query.destAddress!.toString();
    const swap = await createSwapFromSolanaInstructions(
      swiftQuote!,
      swapperWallet,
      destAddress,
      {
        evm: evmReferrer,
        solana: solanaReferrer,
      },
      new Connection("https://api.mainnet-beta.solana.com")
    );

    let instructions: {
      programId: string;
      data: string;
      accounts: { isSigner: boolean; isWritable: boolean; pubkey: string }[];
    }[] = [];
    for (let ix of swap.instructions) {
      instructions.push({
        programId: ix.programId.toString(),
        data: ix.data.toString("base64"),
        accounts: ix.keys.map((k) => ({
          isSigner: k.isSigner,
          isWritable: k.isWritable,
          pubkey: k.pubkey.toString(),
        })),
      });
    }

    res.json({
      addressLookupTableAddresses: swap.lookupTables.map((lt) =>
        lt.key.toString()
      ),
      instructions: instructions,
    });
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.get("/evm", async (req: Request, res: Response) => {
  try {
    const amountIn = Number(req.query.amountIn);
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = Number(req.query.slippageBps);
    const gasDrop = Number(req.query.gasDrop);
    const referrerBps = Number(req.query.referrerBps);
    const evmReferrer = req.query.evmReferrer!.toString();
    const solanaReferrer = req.query.solanaReferrer!.toString();
    if (!chainNames.includes(fromChain) || !chainNames.includes(toChain)) {
      res.status(406).send("Invalid chain name");
      return;
    }
    const quotes = await fetchQuote(
      {
        amount: Number(amountIn),
        fromToken: fromToken!.toString(),
        toToken: toToken!.toString(),
        fromChain: fromChain as ChainName,
        toChain: toChain as ChainName,
        slippageBps: slippageBps,
        gasDrop: gasDrop,
        referrerBps: referrerBps,
        referrer: fromChain === "solana" ? solanaReferrer : evmReferrer,
      },
      {
        gasless: false,
        mctp: false,
        onlyDirect: false,
        swift: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!swiftQuote) {
      res.status(406).send("No SWIFT quote available");
    }

    const swapperWallet = req.query.swapperAddress!.toString();
    const signerAddress = req.query.signerAddress!.toString();;
    const destAddress = req.query.destAddress!.toString();
    const swap = getSwapFromEvmTxPayload(
      swiftQuote!,
      swapperWallet,
      destAddress,
      {
        evm: evmReferrer,
        solana: solanaReferrer,
      },
      signerAddress,
      chainNameToId[fromChain],
      null,
      null
    );

    res.json(swap);
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
