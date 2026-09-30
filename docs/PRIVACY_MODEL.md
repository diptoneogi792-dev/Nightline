# Privacy model

## Trust boundary

The browser owns the exact answers, private reflection, worker secret, next worker secret, pulse nonce, and Midnight private state. The 1AM wallet owns wallet keys and transaction approval. The proof server receives the private circuit witness, including exact pulse scores and the worker secret, through Midnight’s proving protocol, so it must remain local or on a machine the student controls over an encrypted channel. It never receives a wallet seed phrase or the private reflection text. The chain receives only values explicitly disclosed by Compact. The API receives only finalized public receipt fields. Gemini receives only redacted public rules and approved labels.

| Surface | Can observe | Cannot observe |
| --- | --- | --- |
| Browser storage | Exact answers, note, worker secrets, retained public receipts | Wallet seed or extension signing key |
| 1AM | Wallet data and transactions it approves | Nightline’s private note; Nightline does not send it |
| Midnight chain/indexer | Worker commitment, coarse band counters, nullifiers, addresses, finalized transactions | Exact answers, reflection, worker secret |
| Nightline API / Neon | Public receipt fields, aggregate counts, disclosure scope, request hashes | Witnesses, answers, notes, seeds, credentials, identity documents |
| Gemini | Redacted public requirement and approved labels | Answers, notes, credentials, wallet addresses, secrets, documents |

## Disclosure justification

- `workerCommitment`: disclosed during construction so later circuits can prove control without exposing the secret.
- Answer range assertions: disclose only that each successful value satisfied 0–4. The value itself remains private.
- `nullifier`: disclosed so the public set can reject replay. It is a domain-separated hash of the worker secret and fresh local nonce.
- Classification comparisons: disclose only the branch needed to update the public support band.
- `nextCommitment`: disclosed during key rotation so future calls bind to the new local secret.

## Data minimization controls

The receipt Pydantic model forbids extra fields and scans nested field names for private-data terms before database access. Gemini input is redacted before transmission. Raw public requirements are hashed before storage. The frontend registers a receipt only after Midnight.js returns finalized public transaction data.

## Threats and limits

Local browser compromise can expose device-held state. Clearing storage can make the worker secret unrecoverable. A public worker contract can be correlated with its own later transactions even though it is not linked to a student identity by Nightline. Very small cohorts can make aggregate bands identifying; production deployments should suppress cohorts below a public minimum. Backend receipt submission should be verified independently against the indexer before institutional decisions use the aggregate.
