# Architecture

```text
Student browser
  ├─ React UI
  ├─ local answers + reflection + worker secret
  ├─ compiled Compact keys and ZKIR
  └─ Midnight.js providers
       ├─ 1AM wallet: connect, balance, approve, submit
       ├─ proof server: generate ZK proof
       └─ indexer: public state and finality

Midnight chain
  └─ personal Nightline worker
       ├─ public worker commitment
       ├─ public band counters
       ├─ public used-nullifier set
       └─ private witness verification

Render API
  ├─ FastAPI + Pydantic privacy gate
  ├─ Gemini public-policy explainer
  └─ SQLAlchemy async
       └─ Neon development / production branches
```

## Transaction sequence

1. The browser discovers UUID-keyed DApp Connector 4.x providers and prefers 1AM.
2. `connect(network)` returns the wallet configuration for Preview or Preprod.
3. Midnight.js constructs the worker deployment from the compiled contract and browser-held initial private state.
4. The proof provider proves the constructor, 1AM balances the transaction with DUST, and 1AM submits it.
5. The indexer resolves finality. Only then does the UI retain and display the contract address, transaction hash, transaction ID, block height, and timestamp.
6. `submitPulse` reads the private witness, validates scores, derives and checks a nullifier, reveals the band, and updates the public counter.
7. After finality, the frontend sends the public receipt subset to FastAPI for aggregate metrics.

## Environments

Netlify serves the static Vite bundle and compiled browser artifacts. Render runs only the FastAPI container. The proof server remains local or otherwise controlled by the user through 1AM because it receives private witness material. Neon supplies pooled application traffic and a direct Alembic migration connection. Preview and Preprod each retain a separate worker receipt and require a fresh wallet session when selected.
