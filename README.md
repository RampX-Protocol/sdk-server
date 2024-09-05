# sdk-server

# examples

- solana: `curl --request GET \
  --url 'http://localhost:3000/solana?amountIn=0.5&fromToken=0x0000000000000000000000000000000000000000&toToken=0x0000000000000000000000000000000000000000&fromChain=solana&toChain=base&slippageBps=300&gasDrop=0.001&referrerBps=5&evmReferrer=0x4294844b7447A16f58E581F312dEDfd726157B27&solanaReferrer=Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V&swapperAddress=9xZJpqWx4Rzx5Mxxyxp1HXrNtbcZVZjfSftRr2aMWT88&destAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&relayerAddress=3S39HueCTJqS3bm1gk1wnoDgLji7eGQoA99jsKvTgKoi' \
  --header 'User-Agent: insomnia/9.3.2'`
- evm: `curl --request GET \
  --url 'http://localhost:3000/evm?amountIn=0.5&fromToken=0x0000000000000000000000000000000000000000&toToken=0x0000000000000000000000000000000000000000&fromChain=arbitrum&toChain=base&slippageBps=300&gasDrop=0.001&referrerBps=5&evmReferrer=0x28A328C327307ab1b180327234fDD2a290EFC6DE&solanaReferrer=Bv4jL8FWnqCCaZtUCFRqPdhCVp5vDsndh2aRduq4kc3V&swapperAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&destAddress=0x28A328C327307ab1b180327234fDD2a290EFC6DE&signerAddress=0x4294844b7447A16f58E581F312dEDfd726157B27' \
  --header 'User-Agent: insomnia/9.3.2'`

# shared params explanation
- amountIn: Number (for example 0.001 means 0.001 eth if token addr is 0x0000000000000000000000000000000000000000)
- fromToken: source Token on source chain. Use `0x0000000000000000000000000000000000000000` for native chain's token
- toToken: dest Token on source chain. Use `0x0000000000000000000000000000000000000000` for native chain's token
- fromChain: source chain name (
      "solana",
  "ethereum",
  "bsc",
  "polygon",
  "avalanche",
  "arbitrum",
  "optimism",
  "base" for now
)
- toChain: dest chain name
- slippageBps: number or 'auto' to set a suitable value automatically
- gasDrop: number. gas paid to user on destination chain if needed
- referrerBps: number to pay bps fees to the set referrer
- evmReferrer: and evm address that will be set to track transactions and pay referrer fees to
- solanaReferrer: solana equivalent of evmReferrer
- swapperAddress: the user wallet's address on source chain
- destAddress: the user wallet's address on dest chain

## solana: http://localhost:5000/solana
- relayerAddress: this solana address will pay the initiate tx cost. If the user wants to initiate it's the same as swapperAddress. otherwise set it to your own relayer
- 
## evm: http://localhost:5000/evm
- signerAddress: the wallet that will pay the tx costs