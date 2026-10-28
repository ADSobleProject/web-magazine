// 기사 작성 화면: 워드형 편집기(Quill), 이미지 업로드, 카테고리별 세부 분류, 저장 안 한 변경 경고.
const Quill = window.Quill;
const form = document.getElementById('article-form');
const bodyField = document.getElementById('body_html');
const csrf = document.querySelector('meta[name="csrf-token"]').content;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

async function uploadImage(file) {
  const data = new FormData();
  data.append('file', file);
  const res = await fetch('/admin/api/uploads', { method: 'POST', body: data, headers: { 'x-csrf-token': csrf } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || '이미지를 올리지 못했습니다.');
  return json.url;
}

function pickFile(onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT;
  input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
  input.click();
}

/* ---------- 본문 편집기 ---------- */
let dirty = false;

const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: '본문을 입력하세요',
  modules: {
    toolbar: {
      container: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['blockquote', 'link', 'image'],
        ['clean']
      ],
      handlers: {
        image() {
          pickFile((file) => insertImages(this.quill.getSelection(true), [file]));
        }
      }
    },
    // 끌어 놓거나 붙여 넣은 이미지도 서버에 올린 뒤 주소로 넣는다(본문에 이미지 데이터를 통째로 넣지 않게).
    uploader: {
      mimetypes: ACCEPT.split(','),
      handler(range, files) {
        insertImages(range, files);
      }
    }
  }
});

async function insertImages(range, files) {
  let index = range ? range.index : quill.getLength();
  for (const file of files) {
    try {
      const url = await uploadImage(file);
      quill.insertEmbed(index, 'image', url, 'user');
      index += 1;
    } catch (err) {
      window.alert(err.message);
    }
  }
  quill.setSelection(index, 0, 'silent');
}

// 저장된 본문을 편집기에 불러온다. textarea 값은 서버가 이스케이프해서 넣었으므로 그대로 읽는다.
quill.setContents(quill.clipboard.convert({ html: bodyField.value }), 'silent');
quill.on('text-change', () => { dirty = true; });

// 편집기 영역과 도구 버튼에 화면 낭독기용 한국어 이름을 붙인다(Quill 기본값은 영어).
quill.root.setAttribute('aria-labelledby', 'body-label');
quill.root.setAttribute('role', 'textbox');
quill.root.setAttribute('aria-multiline', 'true');

const TOOL_LABELS = {
  '.ql-bold': '굵게',
  '.ql-italic': '기울임',
  '.ql-underline': '밑줄',
  '.ql-strike': '취소선',
  '.ql-list[value="ordered"]': '번호 목록',
  '.ql-list[value="bullet"]': '글머리 목록',
  '.ql-indent[value="-1"]': '내어쓰기',
  '.ql-indent[value="+1"]': '들여쓰기',
  '.ql-blockquote': '인용',
  '.ql-link': '링크',
  '.ql-image': '이미지 넣기',
  '.ql-clean': '서식 지우기',
  '.ql-header .ql-picker-label': '문단 형식',
  '.ql-align .ql-picker-label': '정렬'
};
const toolbar = quill.getModule('toolbar').container;
for (const [selector, label] of Object.entries(TOOL_LABELS)) {
  toolbar.querySelectorAll(selector).forEach((el) => {
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  });
}

/* ---------- 대표 이미지 ---------- */
const thumbField = document.getElementById('thumbnail');
const thumbPreview = document.getElementById('thumb-preview');
const thumbClear = document.getElementById('thumb-clear');

function showThumb(url) {
  thumbField.value = url;
  thumbPreview.replaceChildren();
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    thumbPreview.append(img);
  } else {
    const none = document.createElement('span');
    none.textContent = '없음';
    thumbPreview.append(none);
  }
  thumbClear.hidden = !url;
  dirty = true;
}

document.getElementById('thumb-pick').addEventListener('click', () => {
  pickFile(async (file) => {
    try {
      showThumb(await uploadImage(file));
    } catch (err) {
      window.alert(err.message);
    }
  });
});
thumbClear.addEventListener('click', () => showThumb(''));

/* ---------- 카테고리에 맞는 세부 분류 ---------- */
const category = document.getElementById('category');
const sub = document.getElementById('sub');
const subsByCategory = JSON.parse(category.dataset.subs);

category.addEventListener('change', () => {
  const options = [new Option('없음', '')].concat((subsByCategory[category.value] || []).map((s) => new Option(s, s)));
  sub.replaceChildren(...options);
});

/* ---------- 저장 ---------- */
form.addEventListener('input', () => { dirty = true; });
form.addEventListener('submit', () => {
  bodyField.value = quill.getSemanticHTML();
  dirty = false;
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});
