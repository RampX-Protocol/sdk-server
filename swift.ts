import { Keypair, SystemProgram } from '@solana/web3.js';
import {
    ethers,
    ZeroAddress
} from 'ethers';
import {
    getAmountOfFractionalAmount,
    getGasDecimal,
    getWormholeChainIdById,
    getWormholeChainIdByName,
    hexToUint8Array,
    nativeAddressToHexString
} from './utils';
import { Erc20Permit, Quote, SwiftEvmOrderTypedData } from '@mayanfinance/swap-sdk';

export function createSwiftOrderHash(
	quote: Quote, swapperAddress: string, destinationAddress: string,
	referrerAddress: string | null | undefined, randomKeyHex: string
): Buffer {
	const orderDataSize = 239;
	const data = Buffer.alloc(orderDataSize);
	let offset = 0;

	const sourceChainId = getWormholeChainIdByName(quote.fromChain);
	const trader = Buffer.from(hexToUint8Array(nativeAddressToHexString(swapperAddress, sourceChainId!)));
	data.set(trader, 0);
	offset += 32;


	data.writeUInt16BE(sourceChainId!, offset);
	offset += 2;

	const _tokenIn = quote.swiftInputContract === ZeroAddress ?
		nativeAddressToHexString(SystemProgram.programId.toString(), getWormholeChainIdByName('solana')!) :
		nativeAddressToHexString(quote.swiftInputContract, sourceChainId!);
	const tokenIn = Buffer.from(hexToUint8Array(_tokenIn));
	data.set(tokenIn, offset);
	offset += 32;

	const destinationChainId = getWormholeChainIdByName(quote.toChain);
	const destAddress = Buffer.from(hexToUint8Array(nativeAddressToHexString(destinationAddress, destinationChainId!)));
	data.set(destAddress, offset);
	offset += 32;

	data.writeUInt16BE(destinationChainId!, offset);
	offset += 2;

	const _tokenOut =
		quote.toToken.contract === ZeroAddress ?
			nativeAddressToHexString(SystemProgram.programId.toString(), getWormholeChainIdByName('solana')!) :
			nativeAddressToHexString(quote.toToken.contract, destinationChainId!);
	const tokenOut = Buffer.from(hexToUint8Array(_tokenOut));
	data.set(tokenOut, offset);
	offset += 32;

	data.writeBigUInt64BE(getAmountOfFractionalAmount(quote.minAmountOut, Math.min(quote.toToken.decimals, 8)), offset);
	offset += 8;

	data.writeBigUInt64BE(getAmountOfFractionalAmount(quote.gasDrop, Math.min(getGasDecimal(quote.toChain), 8)), offset);
	offset += 8;

	data.writeBigUInt64BE(BigInt(quote.cancelRelayerFee64), offset);
	offset += 8;

	data.writeBigUInt64BE(BigInt(quote.refundRelayerFee64), offset);
	offset += 8;

	data.writeBigUInt64BE(BigInt(quote.deadline64), offset);
	offset += 8;

	const refAddress = referrerAddress ?
		Buffer.from(hexToUint8Array(nativeAddressToHexString(referrerAddress, destinationChainId!))) :
		SystemProgram.programId.toBuffer();
	data.set(refAddress, offset);
	offset += 32;

	data.writeUInt8(quote.referrerBps!, offset);
	offset += 1;

	const feeRateMayan = quote.protocolBps;
	data.writeUInt8(feeRateMayan!, offset);
	offset += 1;

	data.writeUInt8(quote.swiftAuctionMode!, offset);
	offset += 1;

	const _randomKey = Buffer.from(hexToUint8Array(randomKeyHex));
	data.set(_randomKey, offset);
	offset += 32;

	if (offset !== orderDataSize) {
		throw new Error(`Invalid order data size: ${offset}`);
	}

	const hash = ethers.keccak256(data);
	return Buffer.from(hexToUint8Array(hash));
}

export type SwiftOrderParams = {
	trader: string;
	tokenOut: string;
	minAmountOut: bigint;
	gasDrop: bigint;
	cancelFee: bigint;
	refundFee: bigint;
	deadline: bigint;
	destAddr: string;
	destChainId: number;
	referrerAddr: string;
	referrerBps: number;
	auctionMode: number;
	random: string;
};

export type EvmSwiftParams = {
	contractAddress: string;
	tokenIn: string;
	amountIn: bigint;
	order: SwiftOrderParams;
};

export function getEvmSwiftParams(
	quote: Quote, swapperAddress: string, destinationAddress: string,
	referrerAddress: string | null | undefined, signerChainId: string | number
): EvmSwiftParams {
	const signerWormholeChainId = getWormholeChainIdById(Number(signerChainId));
	const sourceChainId = getWormholeChainIdByName(quote.fromChain);
	const destChainId = getWormholeChainIdByName(quote.toChain);
	if (sourceChainId !== signerWormholeChainId) {
		throw new Error(`Signer chain id(${Number(signerChainId)}) and quote from chain are not same! ${sourceChainId} !== ${signerWormholeChainId}`);
	}
	if (!quote.swiftMayanContract) {
		throw new Error('SWIFT contract address is missing');
	}

	if (quote.toToken.wChainId !== destChainId) {
		throw new Error(`Destination chain ID mismatch: ${destChainId} != ${quote.toToken.wChainId}`);
	}
	const contractAddress = quote.swiftMayanContract;

	if (!Number(quote.deadline64)) {
		throw new Error('Swift order requires timeout');
	}

	const deadline = BigInt(quote.deadline64);

	const tokenIn = quote.swiftInputContract;
	const amountIn = getAmountOfFractionalAmount(
		quote.effectiveAmountIn,
		quote.fromToken.decimals
	);
	let referrerHex: string;
	if (referrerAddress) {
		referrerHex = nativeAddressToHexString(
			referrerAddress,
			destChainId!
		);
	} else {
		referrerHex = nativeAddressToHexString(
			SystemProgram.programId.toString(),
			1
		);
	}

	const random = nativeAddressToHexString(Keypair.generate().publicKey.toString(), 1);

	const tokenOut = quote.toToken.contract === ZeroAddress ?
		nativeAddressToHexString(SystemProgram.programId.toString(), 1) :
		nativeAddressToHexString(quote.toToken.contract, destChainId!);

	const minAmountOut = getAmountOfFractionalAmount(
		quote.minAmountOut, Math.min(8, quote.toToken.decimals)
	);

	const gasDrop = getAmountOfFractionalAmount(
		quote.gasDrop,
		Math.min(8, getGasDecimal(quote.toChain))
	);

	const destinationAddressHex = nativeAddressToHexString(destinationAddress, destChainId!);
	const orderParams: SwiftOrderParams = {
		trader: nativeAddressToHexString(swapperAddress, sourceChainId!),
		tokenOut,
		minAmountOut,
		gasDrop,
		cancelFee: BigInt(quote.cancelRelayerFee64),
		refundFee: BigInt(quote.refundRelayerFee64),
		deadline,
		destAddr: destinationAddressHex,
		destChainId: destChainId!,
		referrerAddr: referrerHex,
		referrerBps: quote.referrerBps || 0,
		auctionMode: quote.swiftAuctionMode!,
		random,
	};

	return {
		contractAddress,
		tokenIn,
		amountIn,
		order: orderParams
	};
}


export function getSwiftOrderTypeData(
	quote: Quote, orderHash: string, signerChainId: number | string
): SwiftEvmOrderTypedData {
	if (!Number.isFinite(Number(signerChainId))) {
		throw new Error('Invalid signer chain id');
	}

	const totalAmountIn = getAmountOfFractionalAmount(quote.effectiveAmountIn, quote.swiftInputDecimals);
	const submitFee = BigInt(quote.submitRelayerFee64);
	return {
		domain: {
			name: 'Mayan Swift',
			chainId: Number(signerChainId),
			verifyingContract: quote.swiftMayanContract!,
		},
		types: {
			CreateOrder: [
				{ name: 'OrderId', type: 'bytes32' },
				{ name: 'InputAmount', type: 'uint256' },
				{ name: 'SubmissionFee', type: 'uint256' },
			],
		},
		value: {
			OrderId: orderHash,
			InputAmount:  totalAmountIn - submitFee,
			SubmissionFee: submitFee,
		}
	}
}

export type SwiftEvmGasLessParams = {
	permitParams: Erc20Permit;
	orderHash: string;
	orderParams: {
		trader: string;
		sourceChainId: number;
		tokenIn: string;
		amountIn: bigint;
		destAddr: string;
		destChainId: number;
		tokenOut: string;
		minAmountOut: bigint;
		gasDrop: bigint;
		cancelFee: bigint;
		refundFee: bigint;
		deadline: bigint;
		referrerAddr: string;
		referrerBps: number;
		auctionMode: number;
		random: string;
		submissionFee: bigint;
	};
	orderTypedData: SwiftEvmOrderTypedData;
}

export function getSwiftFromEvmGasLessParams(
	quote: Quote, swapperAddress: string, destinationAddress: string, referrerAddress: string | null | undefined,
	signerChainId: number | string, permit: Erc20Permit | null
): SwiftEvmGasLessParams {
	if (quote.type !== 'SWIFT') {
		throw new Error('Quote type is not SWIFT');
	}

	if (!quote.gasless) {
		throw new Error('Quote does not support gasless');
	}

	if (!Number.isFinite(Number(signerChainId))) {
		throw new Error('Invalid signer chain id');
	}

	if (!Number(quote.deadline64)) {
		throw new Error('Swift order requires timeout');
	}

	if (quote.fromToken.contract !== quote.swiftInputContract) {
		throw new Error('Swift gasless order creation does not support source swap');
	}

	const {
		tokenIn,
		amountIn,
		order,
		contractAddress: swiftContractAddress
	} = getEvmSwiftParams(
		quote, swapperAddress, destinationAddress,
		referrerAddress, Number(signerChainId)
	);
	const sourceChainId = getWormholeChainIdByName(quote.fromChain);

	const orderHashBuf = createSwiftOrderHash(quote, swapperAddress, destinationAddress, referrerAddress, order.random);
	const orderHash = `0x${orderHashBuf.toString('hex')}`
	const orderTypedData = getSwiftOrderTypeData(quote, orderHash, signerChainId);

	return {
		permitParams: permit!,
		orderParams: {
			...order,
			sourceChainId: sourceChainId!,
			amountIn,
			tokenIn,
			submissionFee: BigInt(quote.submitRelayerFee64),
		},
		orderHash,
		orderTypedData
	};
}