import { t } from './i18n.js';
// Lobby transport: one MQTT topic per lobby over a public WebSocket broker.
// The host publishes its authoritative state as a retained message, so anyone
// who (re)connects gets the current state immediately. Player actions are plain
// messages on the same topic. No accounts, no own server; the brokers are public
// test services, so treat the channel as a friends-only convenience.
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

export function lobbyTopic(code) {
  return `steamguessr/v1/${code}`;
}

export async function openChannel(code, { onMessage, onStatus }) {
  const { default: mqtt } = await import('mqtt');
  const topic = lobbyTopic(code);
  const clientId = 'sg-' + Math.random().toString(36).slice(2, 12);
  let client = null;

  const tryConnect = (url) => new Promise((resolve, reject) => {
    const c = mqtt.connect(url, { clientId, connectTimeout: 8000, reconnectPeriod: 2000, keepalive: 30, clean: true });
    let settled = false;
    const fail = (err) => { if (settled) return; settled = true; c.end(true); reject(err); };
    c.once('connect', () => { if (settled) return; settled = true; resolve(c); });
    c.on('error', fail);
    setTimeout(() => fail(new Error('timeout')), 9000);
  });

  for (const url of BROKERS) {
    try {
      client = await tryConnect(url);
      break;
    } catch {
      if (onStatus) onStatus('retry');
    }
  }
  if (!client) throw new Error(t('mp.netFail'));

  client.on('message', (t, payload) => {
    if (t !== topic || !payload.length) return;
    try {
      onMessage(JSON.parse(payload.toString()));
    } catch {
      /* ignore malformed messages */
    }
  });
  client.on('reconnect', () => onStatus && onStatus('reconnecting'));
  client.on('connect', () => onStatus && onStatus('connected'));
  client.on('offline', () => onStatus && onStatus('offline'));

  await new Promise((resolve, reject) => client.subscribe(topic, { qos: 1 }, (err) => (err ? reject(err) : resolve())));
  if (onStatus) onStatus('connected');

  let closed = false;
  return {
    publish(msg, retain = false) {
      if (closed) return;
      client.publish(topic, JSON.stringify(msg), { qos: 1, retain });
    },
    clearRetained() {
      if (!closed) client.publish(topic, '', { qos: 1, retain: true });
    },
    close() {
      closed = true;
      client.end(true);
    },
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeLobbyCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
