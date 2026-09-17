'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../data.js');
require('../engine.js');
const E = globalThis.PreferenceEngine;
function complete(pick = () => 0) {
  let state = E.fresh();
  while (E.next(state)) {
    const node = E.next(state);
    state = E.select(state, node.id, E.candidates(state, node.id)[pick(node)]).state;
  }
  return state;
}
test('原图 48 项及 46 个节点，最终三选一', () => {
  assert.equal(globalThis.PreferenceData.options.length, 48);
  assert.deepEqual(E.rounds.map(round => round.length), [24, 12, 6, 3, 1]);
  assert.equal(E.total, 46);
  assert.equal(E.byId[E.finalId].sources.length, 3);
  assert.deepEqual(E.candidates(E.fresh(), 'r0-0'), ['trait-1', 'trait-2']);
  assert.deepEqual(E.candidates(E.fresh(), 'r0-23'), ['trait-47', 'trait-48']);
});
test('完整选择、第三个决赛选项及只读旧状态', () => {
  const state = complete(node => node.round === 4 ? 2 : 0);
  assert.equal(Object.keys(state.winners).length, 46);
  assert.equal(state.winners[E.finalId], 'trait-33');
  assert.equal(E.next(state), undefined);
  const updated = E.select(state, 'r0-0', 'trait-2');
  assert.equal(state.winners['r0-0'], 'trait-1');
  assert.equal(updated.state.winners['r0-0'], 'trait-2');
});
test('改选清空全部祖先，即使祖先的旧胜者来自其他分支', () => {
  const state = complete(() => 1);
  const before = JSON.stringify(state);
  const result = E.select(state, 'r0-0', 'trait-1');
  assert.equal(result.cleared, 4);
  for (const id of ['r1-0', 'r2-0', 'r3-0', 'r4-0']) assert.equal(result.state.winners[id], undefined);
  for (const node of E.nodes.filter(node => !['r0-0', 'r1-0', 'r2-0', 'r3-0', 'r4-0'].includes(node.id))) assert.equal(result.state.winners[node.id], state.winners[node.id]);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(E.restore(state), state);
});
test('同项改选无副作用，未齐全节点和非法选项拒绝', () => {
  const state = complete();
  const result = E.select(state, 'r0-0', 'trait-1');
  assert.equal(result.state, state);
  assert.equal(result.changed, false);
  assert.equal(result.cleared, 0);
  assert.throws(() => E.select(E.fresh(), 'r1-0', 'trait-1'));
  assert.throws(() => E.select(E.fresh(), 'r0-0', 'trait-3'));
  assert.throws(() => E.select(E.fresh(), 'missing', 'trait-1'));
});
test('刷新恢复合法进度，拒绝损坏或不兼容记录', () => {
  const state = complete();
  assert.deepEqual(E.restore(JSON.parse(JSON.stringify(state))), state);
  assert.throws(() => E.restore({ version: 9, winners: {} }));
  assert.throws(() => E.restore({ version: 1, winners: { 'r1-0': 'trait-1' } }));
  assert.throws(() => E.restore({ version: 1, winners: { 'r0-0': '<script>' } }));
});
test('按列从上到下推进；全局提前完成合法节点后仍定位最早未完成组', () => {
  let state = E.fresh();
  state = E.select(state, 'r0-1', 'trait-3').state;
  assert.equal(E.next(state).id, 'r0-0');
  state = E.select(state, 'r0-0', 'trait-1').state;
  assert.equal(E.next(state).id, 'r0-2');
  assert.equal(E.ready(state, 'r1-0'), true);
});
test('翻题按题目顺序跳过候选不全节点，不修改选择', () => {
  const state = E.fresh();
  assert.equal(E.adjacent(state, 'r0-0', -1), undefined);
  assert.equal(E.adjacent(state, 'r0-0', 1).id, 'r0-1');
  assert.equal(E.adjacent(state, 'r0-23', 1), undefined);
  let updated = E.select(state, 'r0-0', 'trait-1').state;
  updated = E.select(updated, 'r0-1', 'trait-3').state;
  const before = JSON.stringify(updated);
  assert.equal(E.adjacent(updated, 'r0-23', 1).id, 'r1-0');
  assert.equal(E.adjacent(updated, 'r1-0', -1).id, 'r0-23');
  assert.equal(E.adjacent(updated, 'r1-0', 1), undefined);
  assert.equal(JSON.stringify(updated), before);
  const done = complete();
  assert.equal(E.adjacent(done, E.finalId, -1).id, 'r3-2');
  assert.equal(E.adjacent(done, E.finalId, 1), undefined);
});
