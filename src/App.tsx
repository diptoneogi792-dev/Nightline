import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { composeProofPlan, getMetrics, registerReceipt, type Metrics, type ProofPlan } from './lib/api';
import { type AppError, classifyError } from './lib/errors';
import { connectPreferredWallet, NightlineWorker, type PulseChainReceipt, type WalletConnection } from './lib/midnight';
import {
  loadAnswers,
  loadDeployment,
  loadOrCreatePrivateState,
  rotatePrivateState,
  saveAnswers,
  saveDeployment,
  savePrivateState,
  withPulse,
} from './lib/storage';
import type { DeploymentReceipt, Network, OperationPhase, PulseAnswers } from './lib/types';
import type { NightlinePrivateState } from '../contract/src/witnesses';
import { discoverWallets } from './lib/wallet';

const questions: Array<{ key: keyof Pick<PulseAnswers, 'workload' | 'belonging' | 'energy'>; index: string; label: string; hint: string }> = [
  { key: 'workload', index: '01', label: 'Workload pressure', hint: 'How hard is it to keep up this week?' },
  { key: 'belonging', index: '02', label: 'Belonging gap', hint: 'How disconnected do you feel from your cohort?' },
  { key: 'energy', index: '03', label: 'Energy strain', hint: 'How depleted do you feel after class?' },
];

const steps = ['Read', 'Answer', 'Review', 'Connect', 'Deploy', 'Prove', 'Receipt'];
const scoreLabels = ['clear', 'light', 'present', 'heavy', 'critical'];
const emptyMetrics: Metrics = { total_proofs: 0, unique_workers: 0, steady: 0, stretched: 0, urgent: 0 };

const truncate = (value: string, lead = 10, tail = 8): string => value.length > lead + tail + 2 ? `${value.slice(0, lead)}…${value.slice(-tail)}` : value;
const bandFor = (answers: PulseAnswers): 'steady' | 'stretched' | 'urgent' => {
  const total = answers.workload + answers.belonging + answers.energy;
  return total >= 9 ? 'urgent' : total >= 5 ? 'stretched' : 'steady';
};

function App() {
  const reduceMotion = useReducedMotion();
  const [network, setNetwork] = useState<Network>('preview');
  const [answers, setAnswers] = useState<PulseAnswers>(() => loadAnswers());
  const [privateState, setPrivateState] = useState<NightlinePrivateState>(() => loadOrCreatePrivateState());
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [worker, setWorker] = useState<NightlineWorker | null>(null);
  const [deployment, setDeployment] = useState<DeploymentReceipt | null>(() => loadDeployment('preview'));
  const [pulseReceipt, setPulseReceipt] = useState<PulseChainReceipt | null>(null);
  const [phase, setPhase] = useState<OperationPhase>('idle');
  const [error, setError] = useState<AppError | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [metricsLive, setMetricsLive] = useState(false);
  const [plan, setPlan] = useState<ProofPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [receiptSync, setReceiptSync] = useState<'idle' | 'saved' | 'offline'>('idle');
  const [walletCount, setWalletCount] = useState(0);

  const signalBand = useMemo(() => bandFor(answers), [answers]);
  const activeStep = pulseReceipt ? 7 : worker ? 6 : connection ? 5 : 4;

  useEffect(() => {
    saveAnswers(answers);
    setPrivateState((current) => withPulse(current, answers));
  }, [answers]);

  useEffect(() => {
    const refresh = () => setWalletCount(discoverWallets().length);
    refresh();
    window.addEventListener('midnight#ready', refresh);
    const timer = window.setInterval(refresh, 1200);
    return () => {
      window.removeEventListener('midnight#ready', refresh);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    void getMetrics()
      .then((value) => { setMetrics(value); setMetricsLive(true); })
      .catch(() => setMetricsLive(false));
  }, [pulseReceipt]);

  const changeNetwork = (next: Network) => {
    setNetwork(next);
    setConnection(null);
    setWorker(null);
    setDeployment(loadDeployment(next));
    setPulseReceipt(null);
    setError(null);
    setPhase('idle');
  };

  const connect = async () => {
    setError(null);
    setPhase('connecting');
    try {
      const connected = await connectPreferredWallet(network);
      setConnection(connected);
      const retained = loadDeployment(network);
      setDeployment(retained);
      if (retained) {
        const joined = await NightlineWorker.join(connected, network, privateState, retained.contractAddress);
        setWorker(joined);
      }
      setPhase('idle');
    } catch (caught) {
      setError(classifyError(caught));
      setPhase('error');
    }
  };

  const disconnect = () => {
    setConnection(null);
    setWorker(null);
    setPhase('idle');
    setError(null);
  };

  const deploy = async () => {
    if (!connection) return;
    setError(null);
    setPhase('deploying');
    try {
      const result = await NightlineWorker.deploy(connection, network, privateState);
      saveDeployment(result.receipt);
      savePrivateState(privateState);
      setWorker(result.worker);
      setDeployment(result.receipt);
      setPhase('complete');
    } catch (caught) {
      setError(classifyError(caught));
      setPhase('error');
    }
  };

  const submitPulse = async () => {
    if (!worker || !deployment) return;
    const stateForProof = withPulse(privateState, answers);
    setPrivateState(stateForProof);
    setError(null);
    setPulseReceipt(null);
    setReceiptSync('idle');
    setPhase('proving');
    const finalizingTimer = window.setTimeout(() => setPhase('finalizing'), 1800);
    try {
      const receipt = await worker.submitPulse(stateForProof);
      window.clearTimeout(finalizingTimer);
      setPulseReceipt(receipt);
      setPrivateState(withPulse(stateForProof, answers));
      setPhase('complete');
      try {
        await registerReceipt({
          ...deployment,
          pulseTransactionHash: receipt.transactionHash,
          signalBand,
          disclosureScope: ['signal band', 'one-use nullifier', 'worker contract', 'finalized transaction'],
        });
        setReceiptSync('saved');
      } catch {
        setReceiptSync('offline');
      }
    } catch (caught) {
      window.clearTimeout(finalizingTimer);
      setError(classifyError(caught));
      setPhase('error');
    }
  };

  const rotateKey = async () => {
    if (!worker) return;
    setError(null);
    setPhase('proving');
    try {
      await worker.rotateKey(privateState);
      const rotated = rotatePrivateState(privateState);
      setPrivateState(rotated);
      setPhase('complete');
    } catch (caught) {
      setError(classifyError(caught));
      setPhase('error');
    }
  };

  const explainProof = async () => {
    setPlanLoading(true);
    try { setPlan(await composeProofPlan()); }
    catch { setPlan({
      title: 'What this proof says',
      plain_language_summary: 'A valid student signal was classified locally and accepted once without publishing the three answers.',
      private_inputs: ['Three 0–4 answers', 'Student worker secret', 'Local note'],
      public_outputs: ['Support band', 'One-use nullifier', 'Finalized transaction'],
      verifier_note: 'The verifier learns the coarse outcome and replay protection only.',
      source: 'local-fallback',
    }); }
    finally { setPlanLoading(false); }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#pulse" aria-label="Nightline home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Nightline</span>
          <small>student signal / 01</small>
        </a>
        <div className="network-cluster">
          <span className="eyebrow">Network</span>
          <div className="segmented" aria-label="Midnight network">
            {(['preview', 'preprod'] as Network[]).map((item) => (
              <button key={item} className={network === item ? 'active' : ''} onClick={() => changeNetwork(item)}>{item}</button>
            ))}
          </div>
          {connection ? (
            <button className="wallet-pill connected" onClick={disconnect} aria-label="Disconnect wallet session">
              <span className="status-dot" /> {connection.summary.name} <span>Disconnect</span>
            </button>
          ) : (
            <button className="wallet-pill" onClick={connect} disabled={phase === 'connecting'}>
              <span className="wallet-glyph">1</span> {phase === 'connecting' ? 'Waiting for 1AM…' : 'Connect 1AM'}
            </button>
          )}
        </div>
      </header>

      <div className="status-strip" role="status">
        <span><i className={walletCount ? 'live' : ''} /> {walletCount ? `${walletCount} compatible wallet${walletCount > 1 ? 's' : ''} detected` : '1AM not detected yet'}</span>
        <span>Private state <b>this device</b></span>
        <span>Worker <b>{deployment ? truncate(deployment.contractAddress, 8, 6) : 'not deployed'}</b></span>
      </div>

      <main className="workspace">
        <aside className="step-rail" aria-label="Proof journey">
          <span className="rail-label">Proof journey</span>
          <ol>
            {steps.map((step, index) => (
              <li key={step} className={index + 1 <= activeStep ? 'done' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>{step}
              </li>
            ))}
          </ol>
          <div className="rail-foot"><span /> private by default</div>
        </aside>

        <section className="main-column" id="pulse">
          <motion.div className="intro-block" initial={false} animate={{ opacity: 1, y: 0 }}>
            <div>
              <p className="eyebrow coral">Weekly studio pulse / Week 07</p>
              <h1>Say what support you need.<br /><em>Keep the reasons yours.</em></h1>
            </div>
            <div className="requirement-stamp">
              <span>Public requirement</span>
              <strong>One valid pulse</strong>
              <small>Current semester · one use per nonce</small>
            </div>
          </motion.div>

          <section className="panel questionnaire" aria-labelledby="private-answers-title">
            <div className="panel-heading">
              <div>
                <span className="section-number">A</span>
                <div><p className="eyebrow">Local input</p><h2 id="private-answers-title">How is this week landing?</h2></div>
              </div>
              <span className="local-badge">Never uploaded</span>
            </div>

            <div className="questions">
              {questions.map((question) => (
                <div className="question-row" key={question.key}>
                  <div className="question-copy"><span>{question.index}</span><div><h3>{question.label}</h3><p>{question.hint}</p></div></div>
                  <div className="score-control" role="radiogroup" aria-label={question.label}>
                    {[0, 1, 2, 3, 4].map((score) => (
                      <button
                        key={score}
                        role="radio"
                        aria-checked={answers[question.key] === score}
                        aria-label={`${score}: ${scoreLabels[score]}`}
                        className={answers[question.key] === score ? 'selected' : ''}
                        onClick={() => setAnswers((current) => ({ ...current, [question.key]: score }))}
                      >{score}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="note-field">
              <span><b>Private note</b><small>For your own reflection only</small></span>
              <textarea value={answers.note} maxLength={600} onChange={(event) => setAnswers((current) => ({ ...current, note: event.target.value }))} placeholder="What would make next week feel lighter?" />
              <i>{answers.note.length}/600 · stays in this browser</i>
            </label>
          </section>

          <section className="panel proof-console" aria-labelledby="proof-title">
            <div className="panel-heading compact">
              <div><span className="section-number">B</span><div><p className="eyebrow">Zero-knowledge action</p><h2 id="proof-title">Your private signal worker</h2></div></div>
              <span className={`band-chip ${signalBand}`}>local preview · {signalBand}</span>
            </div>

            <div className="worker-grid">
              <div className="worker-visual" aria-hidden="true">
                <motion.div className="orbit orbit-one" animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} />
                <motion.div className="orbit orbit-two" animate={reduceMotion ? undefined : { rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
                <div className="worker-core"><span>{worker ? 'LIVE' : connection ? 'READY' : 'LOCKED'}</span><b>NW</b></div>
              </div>
              <div className="worker-actions">
                <div className="action-state">
                  <span className="eyebrow">Step {worker ? '06' : connection ? '05' : '04'}</span>
                  <h3>{worker ? 'Generate your proof' : connection ? 'Deploy your worker' : 'Connect your 1AM wallet'}</h3>
                  <p>{worker
                    ? 'The proof turns your three answers into one support band. Exact answers never enter the transaction.'
                    : connection
                      ? '1AM will deploy a contract owned by this device and return its finalized address and transaction hash.'
                      : '1AM signs and submits the transaction. Nightline never receives a seed phrase or private wallet key.'}</p>
                </div>

                {deployment && (
                  <div className="deployment-card">
                    <div><span>Worker contract</span><code title={deployment.contractAddress}>{truncate(deployment.contractAddress)}</code></div>
                    <div><span>Deployment transaction</span><code title={deployment.transactionHash}>{truncate(deployment.transactionHash)}</code></div>
                    <small>Retained on this device · {network}</small>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div className="error-box" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert">
                      <strong>{error.kind.replace('-', ' ')}</strong><span>{error.message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!connection ? (
                  <button className="primary-action" onClick={connect} disabled={phase === 'connecting'}>
                    <span>{phase === 'connecting' ? 'Authorizing…' : 'Connect 1AM'}</span><i>04</i>
                  </button>
                ) : !worker ? (
                  <button className="primary-action" onClick={deploy} disabled={phase === 'deploying'}>
                    <span>{phase === 'deploying' ? 'Deploying and finalizing…' : 'Deploy my worker'}</span><i>05</i>
                  </button>
                ) : (
                  <button className="primary-action citron" onClick={submitPulse} disabled={phase === 'proving' || phase === 'finalizing'}>
                    <span>{phase === 'proving' ? 'Generating zero-knowledge proof…' : phase === 'finalizing' ? 'Waiting for finality…' : 'Prove & send signal'}</span><i>06</i>
                  </button>
                )}
                {(phase === 'deploying' || phase === 'proving' || phase === 'finalizing') && (
                  <div className="progress-line"><motion.span initial={{ width: '6%' }} animate={{ width: phase === 'finalizing' ? '84%' : '46%' }} transition={{ duration: 1.2 }} /></div>
                )}
              </div>
            </div>
          </section>

          {pulseReceipt && deployment && (
            <motion.section className="receipt-panel" initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} aria-labelledby="receipt-title">
              <div className="receipt-symbol" aria-hidden="true">✓</div>
              <div className="receipt-main">
                <p className="eyebrow">Finalized public receipt</p>
                <h2 id="receipt-title">Your signal counted as <em>{signalBand}</em>.</h2>
                <p>The network verified a valid private pulse. No exact answer or note was disclosed.</p>
                <div className="receipt-data">
                  <div><span>Contract</span><code>{truncate(deployment.contractAddress, 12, 10)}</code></div>
                  <div><span>Pulse transaction</span><code>{truncate(pulseReceipt.transactionHash, 12, 10)}</code></div>
                  <div><span>Block</span><strong>#{pulseReceipt.blockHeight.toLocaleString()}</strong></div>
                </div>
                <small>{receiptSync === 'saved' ? 'Public receipt synced to campus metrics.' : receiptSync === 'offline' ? 'On-chain receipt finalized; metrics sync is waiting for the API.' : 'Saving public receipt…'}</small>
              </div>
              <button className="text-action" onClick={rotateKey}>Rotate local worker key</button>
            </motion.section>
          )}
        </section>

        <aside className="context-column" id="privacy">
          <section className="privacy-map">
            <div className="aside-heading"><span className="eyebrow">Privacy boundary</span><b>What crosses the line</b></div>
            <div className="boundary-grid">
              <div className="boundary-side private-side">
                <span className="boundary-label"><i /> Your device</span>
                <ul><li>Three exact answers</li><li>Private reflection</li><li>Worker secret</li><li>Wallet keys</li></ul>
              </div>
              <div className="boundary-rule"><motion.span animate={reduceMotion ? undefined : { y: [0, 116, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} /></div>
              <div className="boundary-side public-side">
                <span className="boundary-label"><i /> Public record</span>
                <ul><li>Support band</li><li>One-use nullifier</li><li>Worker contract</li><li>Finalized tx hash</li></ul>
              </div>
            </div>
            <p className="boundary-note">The contract checks the hidden values, then reveals only the minimum useful outcome.</p>
          </section>

          <section className="assistant-card">
            <div className="assistant-head"><span>G</span><div><p className="eyebrow">Gemini / public context only</p><b>Proof explainer</b></div></div>
            {plan ? (
              <div className="assistant-answer"><p>{plan.plain_language_summary}</p><small>{plan.source === 'gemini' ? 'Generated from public policy text.' : 'Deterministic privacy-safe fallback.'}</small></div>
            ) : (
              <p>Ask for a plain-language explanation. Gemini receives the public rule and approved labels—never your answers, note, wallet address, or secret.</p>
            )}
            <button onClick={explainProof} disabled={planLoading}>{planLoading ? 'Composing…' : plan ? 'Explain again' : 'Explain this proof'} <span>↗</span></button>
          </section>

          <section className="metrics-card" id="results">
            <div className="aside-heading"><span className="eyebrow">Campus signal / public</span><b>This week</b></div>
            <div className="metric-total"><strong>{metrics.total_proofs}</strong><span>finalized<br />signals</span></div>
            <div className="metric-bars">
              {(['steady', 'stretched', 'urgent'] as const).map((key) => {
                const value = metrics[key];
                const percent = metrics.total_proofs ? Math.round((value / metrics.total_proofs) * 100) : 0;
                return <div key={key}><span>{key}<b>{value}</b></span><i><span style={{ width: `${percent}%` }} /></i></div>;
              })}
            </div>
            <small><i className={metricsLive ? 'live' : ''} /> {metricsLive ? `${metrics.unique_workers} anonymous workers reporting` : 'API offline · awaiting public receipts'}</small>
          </section>
        </aside>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <a href="#pulse"><span>01</span>Pulse</a><a href="#privacy"><span>02</span>Privacy</a><a href="#results"><span>03</span>Results</a>
      </nav>
    </div>
  );
}

export default App;
