(function (root) {
  'use strict';
  const E = root.PreferenceEngine;

  async function createPNG(state, layout) {
    if (document.fonts?.ready) await document.fonts.ready;
    const header = 220;
    const footer = 74;
    const scale = 1.5;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(layout.width * scale);
    canvas.height = Math.ceil((header + layout.height + footer) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法创建图片画布');
    ctx.scale(scale, scale);
    const font = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    const text = (label, x, y, size, color, weight = 400) => {
      ctx.font = weight + ' ' + size + 'px ' + font;
      ctx.fillStyle = color;
      ctx.fillText(label, x, y);
    };
    function box(x, y, width, height, radius, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    const count = Object.keys(state.winners).length;
    const winner = state.winners[E.finalId];
    ctx.fillStyle = '#0b0a0c';
    ctx.fillRect(0, 0, layout.width, header + layout.height + footer);
    const glow = ctx.createRadialGradient(layout.width, 0, 0, layout.width, 0, 1000);
    glow.addColorStop(0, '#501121');
    glow.addColorStop(1, '#0b0a0c');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, layout.width, header);
    text('反派偏好 · 我的选择', 50, 78, 42, '#fff5f7', 600);
    text('48 种特质，逐轮留下你的偏爱', 50, 120, 22, '#c1aab4');
    text('已完成 ' + count + ' / ' + E.total + ' 次选择', 50, 163, 20, '#ff8c9e');
    text(winner ? '最终偏好：' + E.labels[winner] : '进行中 · 最终偏好尚未选出', 900, 78, 26, '#fff5f7', 500);
    text('已完成 ✓', 900, 124, 19, '#ff8c9e');
    text('可选择', 1050, 124, 19, '#e3d5dc');
    text('等待上游', 1170, 124, 19, '#91818b');
    text('完整晋级图 · 包含未完成的选择', 900, 164, 18, '#b29ba7');
    ctx.strokeStyle = '#4f2535';
    ctx.beginPath();
    ctx.moveTo(50, 197);
    ctx.lineTo(layout.width - 50, 197);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, header);

    // 使用全局视图同一份布局坐标，导出范围不受当前缩放、滚动或页面影响。
    for (const node of E.nodes) {
      if (!node.parent) continue;
      const from = layout.positions[node.id];
      const to = layout.positions[node.parent];
      const x = from.x + 236;
      ctx.strokeStyle = state.winners[node.id] ? '#e54966' : '#49343e';
      ctx.lineWidth = state.winners[node.id] ? 2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(x, from.center);
      ctx.lineTo(x + 32, from.center);
      ctx.lineTo(x + 32, to.center);
      ctx.lineTo(to.x, to.center);
      ctx.stroke();
    }
    E.rounds.forEach((round, i) => {
      const x = layout.positions[round[0].id].x;
      text(i === 4 ? '最终决选' : '第 ' + (i + 1) + ' 轮', x, 32, 18, '#c9aeba');
      text(layout.roundNames[i], x + 120, 32, 20, '#e9d5df', 500);
    });
    for (const node of E.nodes) {
      const p = layout.positions[node.id];
      const selected = state.winners[node.id];
      const ready = E.ready(state, node.id);
      box(p.x, p.y, 236, p.height, 15, selected ? '#24151d' : ready ? '#211a20' : '#141115', selected ? '#a73b55' : ready ? '#78616e' : '#352a31');
      text(node.round === 4 ? '最终决选' : '第 ' + (node.index + 1) + ' 组', p.x + 15, p.y + 24, 13, '#bea2b0');
      text(selected ? '已完成' : ready ? '可选择' : '等待上游', p.x + 158, p.y + 24, 13, selected ? '#ff8c9e' : '#a7909d');
      E.candidates(state, node.id).forEach((id, index) => {
        const chosen = Boolean(id && id === selected);
        const y = p.y + 54 + index * (node.round === 4 ? 38 : 31);
        text(id ? E.labels[id] : '待选出', p.x + 15, y, 20, chosen ? '#ff91a3' : id ? '#e1d6dc' : '#8d7b86', chosen ? 600 : 400);
        text(chosen ? '✓' : '—', p.x + 207, y, 17, chosen ? '#ff91a3' : '#66505d');
      });
    }
    ctx.restore();
    text('反派偏好选择器', 50, header + layout.height + 20, 18, '#b198a5');
    text('此图片记录导出时的选择，不是可恢复进度的存档。', 900, header + layout.height + 20, 17, '#a28b97');
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 编码失败')), 'image/png');
    });
  }
  root.PreferenceExport = { createPNG };
})(window);
