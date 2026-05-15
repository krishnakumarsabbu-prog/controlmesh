import type {
  WorkspaceApplication,
  WorkspaceFlow,
  ValidationPhase,
  RuntimeLogEntry,
  LiveMetric,
  WorkspaceTimelineEvent,
} from '../types';

export const MOCK_APPLICATIONS: WorkspaceApplication[] = [
  {
    id: 'app-paymentapi',
    name: 'PaymentAPI',
    environment: 'PROD',
    domain: 'Payments',
    status: 'healthy',
    producers: [
      { id: 'svc-paymentapi', name: 'PaymentAPI', type: 'producer', qm: 'PAY.QM1', queue: 'PAY.EVENT.OUT', tps: 5456, status: 'healthy' },
    ],
    consumers: [
      { id: 'svc-ledgerservice', name: 'LedgerService', type: 'consumer', qm: 'LEDGER.QM2', queue: 'PAY.EVENT.IN', tps: 5420, status: 'healthy' },
      { id: 'svc-auditservice', name: 'AuditService', type: 'consumer', qm: 'AUDIT.QM2', queue: 'AUDIT.EVENT.IN', tps: 980, status: 'healthy' },
    ],
  },
  {
    id: 'app-billingservice',
    name: 'BillingService',
    environment: 'PROD',
    domain: 'Billing',
    status: 'healthy',
    producers: [
      { id: 'svc-billingservice', name: 'BillingService', type: 'producer', qm: 'PAY.QM1', queue: 'BILL.EVENT.OUT', tps: 1024, status: 'healthy' },
    ],
    consumers: [
      { id: 'svc-ledgerservice-b', name: 'LedgerService', type: 'consumer', qm: 'LEDGER.QM2', queue: 'BILL.EVENT.IN', tps: 1024, status: 'healthy' },
    ],
  },
  {
    id: 'app-notifyservice',
    name: 'NotifyService',
    environment: 'STAGING',
    domain: 'Notifications',
    status: 'degraded',
    producers: [
      { id: 'svc-notifyservice', name: 'NotifyService', type: 'producer', qm: 'NOTIFY.QM1', queue: 'NOTIFY.EVENT.OUT', tps: 312, status: 'degraded' },
    ],
    consumers: [
      { id: 'svc-emailworker', name: 'EmailWorker', type: 'consumer', qm: 'NOTIFY.QM2', queue: 'NOTIFY.EVENT.IN', tps: 305, status: 'healthy' },
    ],
  },
];

export const MOCK_FLOWS: WorkspaceFlow[] = [
  {
    id: 'flow-payment-event',
    name: 'Payment Event Flow',
    appId: 'app-paymentapi',
    sourceQM: 'PAY.QM1',
    targetQM: 'CLOUD.PAY.QM1',
    activePath: 'source',
    trafficSplit: 0,
    status: 'idle',
  },
  {
    id: 'flow-bill-event',
    name: 'Bill Event Flow',
    appId: 'app-billingservice',
    sourceQM: 'PAY.QM1',
    targetQM: 'CLOUD.PAY.QM1',
    activePath: 'source',
    trafficSplit: 0,
    status: 'idle',
  },
];

export const MOCK_VALIDATION_PHASES: ValidationPhase[] = [
  {
    id: 'phase-connectivity',
    label: 'Connectivity',
    checks: [
      { id: 'chk-qm-reach', label: 'QM Reachability', status: 'passed', detail: 'PAY.QM1 → CLOUD.PAY.QM1 reachable', latency: 12 },
      { id: 'chk-tls', label: 'TLS Handshake', status: 'passed', detail: 'mTLS v1.3 verified', latency: 8 },
      { id: 'chk-auth', label: 'Auth / CCDT', status: 'passed', detail: 'Service account bound', latency: 4 },
    ],
  },
  {
    id: 'phase-topology',
    label: 'Topology Snapshot',
    checks: [
      { id: 'chk-queues', label: 'Queue Definitions', status: 'passed', detail: '14 queues verified', latency: 22 },
      { id: 'chk-channels', label: 'Channel Config', status: 'passed', detail: '3 channels active', latency: 18 },
      { id: 'chk-dlq', label: 'DLQ Policy', status: 'warning', detail: 'DLQ depth above threshold on PAY.DLQ', latency: 5 },
    ],
  },
  {
    id: 'phase-flow',
    label: 'Live Flow Probe',
    checks: [
      { id: 'chk-msg-send', label: 'Message Roundtrip', status: 'passed', detail: 'Probe message delivered in 38ms', latency: 38 },
      { id: 'chk-ordering', label: 'Message Ordering', status: 'passed', detail: 'FIFO order maintained', latency: 11 },
      { id: 'chk-throughput', label: 'Throughput Baseline', status: 'passed', detail: '12,455 msg/min (above threshold)', latency: 0 },
    ],
  },
];

export const MOCK_RUNTIME_LOGS: RuntimeLogEntry[] = [
  { timestamp: Date.now() - 52000, level: 'INFO',    service: 'PaymentAPI',    message: 'Sending test message: PAY12345' },
  { timestamp: Date.now() - 51000, level: 'INFO',    service: 'PAY.QM1',       message: 'Message enqueued to PAY.EVENT.OUT' },
  { timestamp: Date.now() - 50000, level: 'INFO',    service: 'CHANNEL.PAY',   message: 'Message delivered successfully' },
  { timestamp: Date.now() - 49000, level: 'INFO',    service: 'LEDGER.QM2',    message: 'Message enqueued to PAY.EVENT.IN' },
  { timestamp: Date.now() - 48000, level: 'INFO',    service: 'LedgerService', message: 'Message consumed successfully' },
  { timestamp: Date.now() - 47000, level: 'INFO',    service: 'LedgerService', message: 'Processing payment: PAY12345' },
  { timestamp: Date.now() - 45000, level: 'INFO',    service: 'LedgerService', message: 'ACK sent' },
  { timestamp: Date.now() - 44000, level: 'SUCCESS', service: 'LedgerService', message: 'End-to-end validation completed' },
  { timestamp: Date.now() - 30000, level: 'WARNING', service: 'PAY.DLQ',       message: 'DLQ depth: 47 messages — above warning threshold' },
];

export const MOCK_LIVE_METRICS: LiveMetric[] = [
  { label: 'Active Path',    value: 'SOURCE',    color: 'cyan',  trend: 'stable' },
  { label: 'Traffic',        value: 12455,       unit: 'msg/min', color: 'cyan', trend: 'up', trendValue: '+8.21%' },
  { label: 'Success Rate',   value: '99.92',     unit: '%',       color: 'green', trend: 'stable' },
  { label: 'Avg Latency',    value: 42,          unit: 'ms',      color: 'cyan', trend: 'down', trendValue: '-3.2%' },
  { label: 'Error Rate',     value: '0.02',      unit: '%',       color: 'green', trend: 'down', trendValue: '-12.5%' },
  { label: 'Consumers Up',   value: '2 / 2',     color: 'green', trend: 'stable' },
];

export const MOCK_TIMELINE_EVENTS: WorkspaceTimelineEvent[] = [
  {
    id: 'evt-1',
    timestamp: Date.now() - 120000,
    type: 'info',
    title: 'Workspace Initialized',
    detail: 'Migration workspace opened for PaymentAPI',
    step: 'app-mapping',
  },
  {
    id: 'evt-2',
    timestamp: Date.now() - 90000,
    type: 'success',
    title: 'Application Selected',
    detail: 'PaymentAPI — 2 producers, 2 consumers mapped',
    step: 'app-mapping',
  },
  {
    id: 'evt-3',
    timestamp: Date.now() - 60000,
    type: 'success',
    title: 'Source Validation Passed',
    detail: 'All connectivity and topology checks passed',
    step: 'source-validation',
  },
  {
    id: 'evt-4',
    timestamp: Date.now() - 20000,
    type: 'warning',
    title: 'DLQ Warning',
    detail: 'PAY.DLQ depth above threshold — review before migration',
    step: 'source-validation',
  },
];
