export function createBananaService({ fetchImpl = fetch, endpoint = process.env.BANANA_API_URL || 'https://marcconrad.com/uob/banana/api.php' } = {}) {
  return async function getPuzzle() {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Banana API returned HTTP ${response.status}`);
    const puzzle = await response.json();
    const imageUrl = puzzle.question;
    const solution = Number(puzzle.solution);
    if (typeof imageUrl !== 'string' || !Number.isInteger(solution) || solution < 0 || solution > 9) {
      throw new Error('Banana API returned an unexpected puzzle format');
    }
    const parsedUrl = new URL(imageUrl);
    const trustedImageHost = ['marcconrad.com', 'sanfoh.com'].some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`));
    if (parsedUrl.protocol !== 'https:' || !trustedImageHost) {
      throw new Error('Banana API returned an unsafe puzzle image URL');
    }
    return { imageUrl, solution };
  };
}

export function getOfflinePuzzle() {
  const left = Math.floor(Math.random() * 8) + 1;
  const right = Math.floor(Math.random() * 8) + 1;
  const solution = left + right;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="220" viewBox="0 0 480 220"><rect width="480" height="220" rx="18" fill="#fff7dc"/><text x="240" y="72" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#30533d">OFFLINE SAMPLE</text><text x="240" y="151" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="700" fill="#163f34">${left} + ${right} = ?</text></svg>`;
  return { imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`, solution };
}