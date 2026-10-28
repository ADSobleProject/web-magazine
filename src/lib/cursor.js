// 이어받기 위치값: 마지막 항목의 게시 시각과 번호를 담는다.
// 목록 중간에 새 기사가 올라와도 "이 위치보다 오래된 것"만 받으므로 중복·누락이 없다.
const MAX_LENGTH = 100;

export function encodeCursor(article) {
  return Buffer.from(JSON.stringify([article.publishedAt, article.id])).toString('base64url');
}

// 형식이 틀리면 null을 돌려준다. 호출하는 쪽에서 400으로 응답한다.
export function decodeCursor(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every(Number.isSafeInteger)) {
      return { publishedAt: parsed[0], id: parsed[1] };
    }
  } catch {
    // 아래에서 null 처리
  }
  return null;
}

// 최신순(게시 시각 내림차순, 같으면 번호 내림차순) 목록에서 위치값보다 뒤에 오는지
export function isAfterCursor(article, cursor) {
  return article.publishedAt < cursor.publishedAt ||
    (article.publishedAt === cursor.publishedAt && article.id < cursor.id);
}
