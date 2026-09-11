let pending;
export function loadFlyAssets() {
  if (!pending) {
    const base = `${import.meta.env.BASE_URL}fly/`;
    const load = async (name) => {
      const r = await fetch(base + name);
      if (!r.ok) throw new Error(`Fly asset ${name}: HTTP ${r.status}`);
      return r.json();
    };
    pending = Promise.all([load('model.json'), load('metrics.json'), load('test-ids.json')])
      .then(([model, metrics, testIds]) => {
        if (!model.readout || !model.nPN || !model.nKC || !model.nMBON || !Array.isArray(testIds) || testIds.length < 5) throw new Error('Invalid fly model');
        return { model, metrics, testIds, signature: `${model.version}:${metrics.sha256['games.json']}` };
      }).catch((error) => { pending = undefined; throw error; });
  }
  return pending;
}
