const checkpoints = [
  [90, 405], [178, 376], [266, 345], [355, 310], [455, 268], [565, 220],
  [655, 270], [745, 286], [835, 288], [925, 273], [1015, 270],
  [1085, 337], [1155, 363], [1225, 374], [1300, 369], [1375, 364],
  [1450, 390], [1530, 405], [1610, 405], [1690, 390], [1770, 376],
  [1855, 370], [1935, 367], [2015, 362], [2095, 365], [2180, 367],
  [2280, 381], [2380, 380], [2480, 380], [2580, 380], [2920, 376]
];

export function positionExplorer(checkpoint) {
  const index = Math.max(0, Math.min(30, checkpoint));
  const [x, y] = checkpoints[index];
  const explorer = document.querySelector('#explorer');
  explorer.style.transform = `translate(${x}px, ${y}px)`;
  explorer.setAttribute('aria-label', `Explorer at checkpoint ${index}`);
  document.querySelector('#world-window').scrollTo({ left: Math.max(0, x - 300), behavior: 'smooth' });
  document.querySelectorAll('[data-lock]').forEach((lock, lockIndex) => {
    lock.classList.toggle('lock-open', index >= 26 + lockIndex);
  });
  document.querySelectorAll('[data-stone]').forEach(stone => {
    stone.classList.toggle('stone-lit', index >= Number(stone.dataset.stone));
  });
  document.querySelector('#gate-door').classList.toggle('gate-open', index >= 30);
}

export function showCheckpointMarkers() {
  const markers = document.querySelector('#checkpoint-markers');
  markers.innerHTML = checkpoints.map(([x, y], index) => {
    if (index % 5 !== 0 || index === 0 || index === 30) return '';
    return `<circle cx="${x}" cy="${y - 30}" r="7" class="checkpoint-marker" data-checkpoint="${index}"/>`;
  }).join('');
}