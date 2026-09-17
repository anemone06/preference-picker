(function (root) {
  'use strict';
  const data = root.PreferenceData;
  const rounds = [];
  const nodes = [];
  let sources = data.options.map(option => ({ option: option.id }));
  for (let round = 0; sources.length > 1; round++) {
    const size = sources.length === 3 ? 3 : 2;
    const group = [];
    for (let index = 0; index < sources.length / size; index++) {
      const node = { id: 'r' + round + '-' + index, round, index, sources: sources.slice(index * size, (index + 1) * size), parent: null };
      for (const source of node.sources) if (source.node) nodes.find(item => item.id === source.node).parent = node.id;
      group.push(node);
      nodes.push(node);
    }
    rounds.push(group);
    sources = group.map(node => ({ node: node.id }));
  }
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  const labels = Object.fromEntries(data.options.map(option => [option.id, option.label]));
  const fresh = () => ({ version: data.version, winners: {} });
  const candidates = (state, id) => byId[id]?.sources.map(source => source.option || state.winners[source.node] || null) || [];
  const ready = (state, id) => candidates(state, id).length > 0 && candidates(state, id).every(Boolean);
  const next = state => nodes.find(node => !state.winners[node.id] && ready(state, node.id));
  function adjacent(state, id, direction) {
    const index = nodes.findIndex(node => node.id === id);
    if (index < 0 || ![-1, 1].includes(direction)) return undefined;
    for (let i = index + direction; i >= 0 && i < nodes.length; i += direction) {
      if (ready(state, nodes[i].id)) return nodes[i];
    }
    return undefined;
  }
  function select(state, id, option) {
    const node = byId[id];
    if (!node || !ready(state, id) || !candidates(state, id).includes(option)) throw new Error('当前选项不可选择');
    if (state.winners[id] === option) return { state, cleared: 0, changed: false };
    const updated = { version: data.version, winners: { ...state.winners, [id]: option } };
    let cleared = 0;
    // 对手变化会改变比较基础，因此沿全部祖先节点清空，不能仅检查旧胜者是否被淘汰。
    for (let parent = node.parent; parent; parent = byId[parent].parent) {
      if (updated.winners[parent]) cleared++;
      delete updated.winners[parent];
    }
    return { state: updated, cleared, changed: true };
  }
  function restore(raw) {
    if (!raw || raw.version !== data.version || !raw.winners || typeof raw.winners !== 'object' || Array.isArray(raw.winners)) throw new Error('进度格式不兼容');
    const state = fresh();
    for (const node of nodes) {
      const value = raw.winners[node.id];
      if (value !== undefined) {
        if (!ready(state, node.id) || !candidates(state, node.id).includes(value)) throw new Error('进度包含无效选择');
        state.winners[node.id] = value;
      }
    }
    return state;
  }
  root.PreferenceEngine = { rounds, nodes, byId, labels, fresh, candidates, ready, next, adjacent, select, restore, total: nodes.length, finalId: nodes[nodes.length - 1].id };
})(typeof window !== 'undefined' ? window : globalThis);
