import {
  ChainName,
  createSwapFromSolanaInstructions,
  fetchQuote,
  getSwapFromEvmTxPayload,
} from "@mayanfinance/swap-sdk";
import { Connection } from "@solana/web3.js";
import express, { Request, Response } from "express";
import { getSwiftFromEvmGasLessParams } from "./swift";
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
    const amountIn64 = req.query.amountIn!.toString();
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = req.query.slippageBps != "auto" ? Number(req.query.slippageBps) : "auto";
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
        amountIn64: amountIn64,
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
      quote: swiftQuote,
      instructions: instructions,
    });
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.get("/evm", async (req: Request, res: Response) => {
  try {
    const amountIn64 = req.query.amountIn!.toString();
    const fromToken = req.query.fromToken!.toString();
    const toToken = req.query.toToken!.toString();
    const fromChain = req.query.fromChain!.toString();
    const toChain = req.query.toChain!.toString();
    const slippageBps = req.query.slippageBps != "auto" ? Number(req.query.slippageBps) : "auto";
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
        amountIn64: amountIn64,
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
    const swapWithExtras = getSwapFromEvmTxPayload(
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
      null,
    );
    // for (let i = 0; i < swap._forwarder.params.length; i++) {
    //   const item = swap._forwarder.params[i];
    //   if (typeof item === "bigint") {
    //     swap._forwarder.params[i] = item.toString();
    //   } else if (typeof item.value === "bigint") {
    //     swap._forwarder.params[i].value = item.value.toString();
    //   }
    // }
    const { _forwarder, ...swap } = swapWithExtras;
    swap.value = swap.value
    res.json({
      quote: swiftQuote,
      swap: swap
    });
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.get("/evm-gasless", async (req: Request, res: Response) => {
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
        gasless: true,
        mctp: false,
        onlyDirect: false,
        swift: true,
      }
    );

    let swiftQuote = quotes.find((q) => q.type === "SWIFT");
    if (!swiftQuote) {
      res.status(406).send("No SWIFT quote available");
    }

    const swiftGasless = await getSwiftFromEvmGasLessParams(
      swiftQuote!,
      req.query.swapperAddress!.toString(),
      req.query.destAddress!.toString(),
      fromChain === "solana" ? solanaReferrer : evmReferrer,
      chainNameToId[fromChain],
      {
        deadline: Number(req.query.permitDeadline),
        r: req.query.permitR!.toString(),
        s: req.query.permitS!.toString(),
        v: Number(req.query.permitV),
        value: BigInt(req.query.permitValue!.toString()),
      }
    );
    swiftGasless.orderTypedData.value.SubmissionFee = swiftGasless.orderTypedData.value.SubmissionFee.toString() as any;
    swiftGasless.orderTypedData.value.InputAmount = swiftGasless.orderTypedData.value.InputAmount.toString() as any;
    res.json(swiftGasless.orderTypedData);
  } catch (err: any) {
    console.error(err, err.stack);
    res.status(500).send(err);
  }
});

app.listen(port, "::", () => {
  console.log(`Server is running on http://localhost:${port}`);
});
